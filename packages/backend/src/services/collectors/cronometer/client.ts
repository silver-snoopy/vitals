export interface CronometerGwtConfig {
  gwtHeader: string;
  gwtPermutation: string;
  gwtModuleBase: string;
  gwtContentType: string;
  gwtUrl: string;
  loginUrl: string;
  exportUrl: string;
  gwtAuthRegex: string;
  gwtTokenRegex: string;
}

export function defaultGwtConfig(gwtHeader: string, gwtPermutation: string): CronometerGwtConfig {
  return {
    gwtHeader,
    gwtPermutation,
    gwtModuleBase: 'https://cronometer.com/cronometer/',
    gwtContentType: 'text/x-gwt-rpc; charset=UTF-8',
    gwtUrl: 'https://cronometer.com/cronometer/app',
    loginUrl: 'https://cronometer.com/login',
    exportUrl: 'https://cronometer.com/export',
    gwtAuthRegex: 'OK\\[(?<userid>\\d*),.*',
    gwtTokenRegex: '"(?<token>.*?)"',
  };
}

class CookieJar {
  private cookies = new Map<string, string>();

  updateFromResponse(headers: Headers): void {
    const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
    const setCookies =
      typeof anyHeaders.getSetCookie === 'function'
        ? anyHeaders.getSetCookie()
        : headers.get('set-cookie')
        ? [headers.get('set-cookie') as string]
        : [];

    for (const entry of setCookies) {
      if (!entry) continue;
      const [pair] = entry.split(';');
      const eqIdx = pair.indexOf('=');
      if (eqIdx < 1) continue;
      const key = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (key) this.cookies.set(key, value);
    }
  }

  applyToRequest(headers: Headers): void {
    if (this.cookies.size === 0) return;
    headers.set(
      'cookie',
      Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    );
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }
}

export class CronometerAuthSession {
  private config: CronometerGwtConfig;
  private username: string;
  private password: string;
  private loggedIn = false;
  private userId?: string;
  private jar = new CookieJar();

  constructor(config: CronometerGwtConfig, username: string, password: string) {
    this.config = config;
    this.username = username;
    this.password = password;
  }

  async exportCsv(exportType: string, startDate: Date, endDate: Date): Promise<string> {
    await this.ensureLogin();
    const nonce = await this.getExportNonce();
    const params = new URLSearchParams({
      nonce,
      generate: exportType,
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
    });
    const headers = new Headers();
    this.jar.applyToRequest(headers);
    const response = await fetch(`${this.config.exportUrl}?${params}`, { headers });
    this.jar.updateFromResponse(response.headers);
    if (!response.ok) throw new Error(`Cronometer export failed: ${response.status}`);
    return response.text();
  }

  private async ensureLogin(): Promise<void> {
    if (this.loggedIn) return;
    if (!this.username || !this.password) {
      throw new Error('Missing Cronometer credentials');
    }

    const csrf = await this.getCsrfToken();
    const body = new URLSearchParams({
      anticsrf: csrf,
      username: this.username,
      password: this.password,
    });
    const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
    this.jar.applyToRequest(headers);

    const response = await fetch(this.config.loginUrl, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
    });
    this.jar.updateFromResponse(response.headers);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const followHeaders = new Headers();
        this.jar.applyToRequest(followHeaders);
        const followResponse = await fetch(location, { headers: followHeaders });
        this.jar.updateFromResponse(followResponse.headers);
        if (!followResponse.ok) {
          throw new Error(`Cronometer login redirect failed: ${followResponse.status}`);
        }
      }
    } else if (response.status === 200) {
      const text = await response.text();
      if (looksLikeLoginFailure(text)) {
        throw new Error('Cronometer login failed (invalid credentials or MFA required)');
      }
    } else if (!response.ok) {
      throw new Error(`Cronometer login failed: ${response.status}`);
    }

    await this.gwtAuthenticate();
    this.loggedIn = true;
  }

  private async getCsrfToken(): Promise<string> {
    const headers = new Headers();
    this.jar.applyToRequest(headers);
    const response = await fetch(this.config.loginUrl, { headers });
    this.jar.updateFromResponse(response.headers);
    if (!response.ok) throw new Error(`Cronometer login page failed: ${response.status}`);
    const text = await response.text();
    const token = this.extractCsrf(text);
    if (!token) throw new Error('Cronometer CSRF token not found on login page');
    return token;
  }

  private extractCsrf(html: string): string | null {
    const patterns = [
      /name="anticsrf"\s+value="([^"]+)"/,
      /anticsrf"\s*:\s*"([^"]+)"/,
      /anticsrf=([A-Za-z0-9\-_]+)/,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1];
    }
    return null;
  }

  private async gwtAuthenticate(): Promise<void> {
    const payload = this.buildGwtAuthPayload();
    const response = await this.gwtRpc(payload);
    const match = response.match(new RegExp(this.config.gwtAuthRegex));
    if (!match?.groups?.userid) {
      throw new Error('Cronometer GWT auth did not return a user id');
    }
    this.userId = match.groups.userid;
  }

  private async getExportNonce(): Promise<string> {
    if (!this.userId) await this.gwtAuthenticate();
    const nonce = this.jar.get('sesnonce');
    if (!nonce) throw new Error('Cronometer sesnonce cookie missing');
    const payload = this.buildGwtTokenPayload(nonce, this.userId as string);
    const response = await this.gwtRpc(payload);
    const match = response.match(new RegExp(this.config.gwtTokenRegex));
    if (!match?.groups?.token) throw new Error('Cronometer export token not found in GWT response');
    return match.groups.token;
  }

  private buildGwtAuthPayload(): string {
    if (!this.config.gwtHeader) throw new Error('Missing Cronometer GWT header (CRONOMETER_GWT_HEADER)');
    return (
      `7|0|5|${this.config.gwtModuleBase}|${this.config.gwtHeader}|` +
      'com.cronometer.shared.rpc.CronometerService|authenticate|' +
      'java.lang.Integer/3438268394|1|2|3|4|1|5|5|-300|'
    );
  }

  private buildGwtTokenPayload(nonce: string, userId: string): string {
    if (!this.config.gwtHeader) throw new Error('Missing Cronometer GWT header');
    return (
      `7|0|8|${this.config.gwtModuleBase}|${this.config.gwtHeader}|` +
      'com.cronometer.shared.rpc.CronometerService|generateAuthorizationToken|' +
      'java.lang.String/2004016611|I|com.cronometer.shared.user.AuthScope/2065601159|' +
      `${nonce}|1|2|3|4|4|5|6|6|7|8|${userId}|3600|7|2|`
    );
  }

  private async gwtRpc(payload: string): Promise<string> {
    if (!this.config.gwtHeader || !this.config.gwtPermutation) {
      throw new Error('Missing Cronometer GWT header or permutation env vars');
    }
    const headers = new Headers({
      'Content-Type': this.config.gwtContentType,
      'X-GWT-Module-Base': this.config.gwtModuleBase,
      'X-GWT-Permutation': this.config.gwtPermutation,
    });
    this.jar.applyToRequest(headers);
    const response = await fetch(this.config.gwtUrl, { method: 'POST', headers, body: payload });
    this.jar.updateFromResponse(response.headers);
    if (!response.ok) throw new Error(`Cronometer GWT RPC failed: ${response.status}`);
    return response.text();
  }
}

function looksLikeLoginFailure(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('invalid') ||
    lower.includes('incorrect') ||
    lower.includes('authentication failed') ||
    lower.includes('two-factor') ||
    lower.includes('mfa')
  );
}

export interface CronometerClient {
  exportDailyNutrition(startDate: Date, endDate: Date): Promise<string>;
  exportBiometrics(startDate: Date, endDate: Date): Promise<string>;
}

export class CronometerGwtClient implements CronometerClient {
  private session: CronometerAuthSession;

  constructor(username: string, password: string, gwtHeader: string, gwtPermutation: string) {
    const config = defaultGwtConfig(gwtHeader, gwtPermutation);
    this.session = new CronometerAuthSession(config, username, password);
  }

  async exportDailyNutrition(startDate: Date, endDate: Date): Promise<string> {
    return this.session.exportCsv('dailySummary', startDate, endDate);
  }

  async exportBiometrics(startDate: Date, endDate: Date): Promise<string> {
    return this.session.exportCsv('biometrics', startDate, endDate);
  }
}
