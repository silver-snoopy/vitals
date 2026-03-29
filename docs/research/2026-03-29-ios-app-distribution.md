# iOS App Distribution Research

**Date:** 2026-03-29
**Author:** Research via dev-pipeline
**Audience:** Developer new to iOS, evaluating how to get an app to users

---

## 1. Prerequisites — Apple Developer Program

Before you can distribute any iOS app by any method, you need an **Apple Developer Program** membership.

| Program | Cost/Year | Who it's for |
|---|---|---|
| Apple Developer Program (individual) | $99 USD | Anyone building for the App Store or testing |
| Apple Developer Enterprise Program | $299 USD | Large organizations distributing internal-only apps to their own employees |

### Enrollment requirements (Individual)
- An Apple ID with two-factor authentication enabled
- Must be the legal age of majority in your region
- A credit card (annual renewal)

### Enrollment requirements (Organization)
- All of the above, plus:
- A **D-U-N-S Number** (free from Dun & Bradstreet — takes a few days to get)
- Must be a legal entity that can enter contracts with Apple

**Fee waivers** are available for nonprofits, accredited educational institutions, and government entities.

> **Beginner tip:** Sign up at [developer.apple.com/programs](https://developer.apple.com/programs). Approval for individuals is usually instant; organizations take 1–5 business days.

---

## 2. App Review Timeline

| Scenario | Typical time |
|---|---|
| First-time app submission | **24–48 hours** |
| Subsequent updates | **~24 hours** (usually faster) |
| Manually flagged / sensitive category | **Up to 1 week** |

**Factors that slow down review:**
- Health, finance, kids, or AI-powered apps get extra scrutiny
- Incomplete submission (missing demo credentials, vague review notes) → rejection within 24 hours, clock resets on resubmit
- US holiday periods — Apple pauses new submissions around late December

> **Planning rule of thumb:** budget **one week** for your first submission to account for one potential rejection + fix + resubmit cycle.
>
> Track current real-time averages at [appreviewtimes.com](https://appreviewtimes.com).

---

## 3. App Store Submission Requirements

### 2a. Technical Requirements (as of April 2026)

| Requirement | Details |
|---|---|
| Build SDK | Must target **iOS & iPadOS 26 SDK** or later (required from April 28, 2026 for new/updated apps) |
| Xcode | Latest stable release strongly recommended |
| Code signing | Valid Apple distribution certificate + provisioning profile |
| App ID | Registered in App Store Connect |
| Bundle ID | Must match exactly across Xcode project and App Store Connect |
| Icons & screenshots | All required sizes must be present (Xcode asset catalog handles most) |
| Privacy manifest | Required for apps using certain APIs (location, camera, contacts, etc.) |
| Privacy nutrition labels | Must accurately declare all data collected and its purpose |

### 2b. App Store Connect Setup

App Store Connect ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)) is Apple's portal for managing apps. Before submitting you must fill in:

- App name, subtitle, description, keywords
- Screenshots for every supported device size (iPhone, iPad if applicable)
- App icon (1024×1024 px)
- Category (primary + optional secondary)
- Age rating (answer questionnaire)
- Privacy policy URL (required for all apps)
- App Privacy labels (data collection declarations)
- Pricing (free or paid)
- Review Notes — login credentials if app requires authentication, plus any context for reviewers

### 2c. App Review Guidelines — The Five Pillars

Apple reviews every submission against five areas:

| Pillar | Key checks |
|---|---|
| **Safety** | No harmful content, no facilitating illegal activity, parental controls respected |
| **Performance** | App must not crash, must work as described, no placeholder or incomplete content |
| **Business** | In-app purchases for digital goods must use Apple IAP, no steering users to external payment |
| **Design** | Must follow Human Interface Guidelines, no bait-and-switch UI |
| **Legal** | Privacy compliance, no IP violations, age rating accuracy |

Full guidelines: [developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/)

---

## 4. Common Rejection Reasons (and How to Avoid Them)

| Rejection reason | How to avoid |
|---|---|
| **App crashes / incomplete** (Guideline 2.1 — #1 cause) | Test on multiple real devices via TestFlight before submitting |
| **Privacy violations** | Add a Privacy manifest, fill in all nutrition labels, explain data use in Review Notes |
| **Missing demo credentials** | Always include a working test account in the App Review Information section |
| **IAP bypass** — digital goods sold outside Apple's system | Use StoreKit for all in-app digital purchases |
| **Metadata mismatch** — description doesn't match app behavior | Review screenshots and description against the actual app before submitting |
| **App too narrow / niche** (public App Store only) | For internal tools, use Unlisted or Custom App distribution instead |
| **Unclear permissions** | Add `NSUsageDescription` strings explaining *why* each permission is needed |

**Review timeline:** 24–48 hours for most apps, up to 1 week if flagged for manual review. Plan ahead.

---

## 5. Delivery Methods — Full Comparison

Six methods exist to install an iOS app on a device. Each has different requirements, limits, and use cases.

### Method 1 — Public App Store

| | |
|---|---|
| **Who can download** | Anyone in the world (or chosen territories) |
| **Apple review required** | Yes — full review |
| **Device limit** | Unlimited |
| **Requires Developer Program** | Yes ($99/yr) |
| **Best for** | Consumer apps, anything intended for the general public |

**Process:** Xcode Archive → Upload to App Store Connect → Submit for review → Goes live after approval.

---

### Method 2 — Unlisted App (hidden App Store)

| | |
|---|---|
| **Who can download** | Anyone with the private direct link |
| **Apple review required** | Yes — full App Store review |
| **Device limit** | Unlimited |
| **Requires Developer Program** | Yes ($99/yr) |
| **Best for** | Client apps, internal tools, research studies, apps not meant to be publicly discoverable |

**How it works:** The app exists on the App Store but does **not** appear in search, charts, or recommendations. Only people with your private link can find and install it. You control who you share the link with.

**Request process:**
1. Submit your app normally via App Store Connect
2. Add a note in Review Notes that you intend unlisted distribution
3. After approval, request unlisted status via App Store Connect settings
4. A private URL is generated — share it with your clients

> **Best option for a beginner wanting private client delivery** — passes through full Apple review, no device limits, no MDM needed, works on any iPhone.

---

### Method 3 — TestFlight (Beta Testing)

| | |
|---|---|
| **Who can download** | Up to **10,000 external testers** via email invite or public link |
| **Apple review required** | Yes — TestFlight beta review (faster, less strict) |
| **Build expiry** | **90 days** per build |
| **Requires Developer Program** | Yes ($99/yr) |
| **Best for** | Beta testing before launch, temporary client demos |

**How it works:** Upload a build to App Store Connect → create a TestFlight group → share the invite link or email. Users install the TestFlight app first, then install your build through it.

**Limitation:** Builds expire after 90 days — not suitable for long-term delivery unless you keep uploading new builds.

---

### Method 4 — Ad Hoc Distribution

| | |
|---|---|
| **Who can download** | Up to **100 registered devices** per year |
| **Apple review required** | No |
| **Device limit** | 100 per device type (iPhone, iPad separately) |
| **Requires Developer Program** | Yes ($99/yr) |
| **Best for** | Small demos, QA testing, internal teams where you control devices |

**How it works:**
1. Collect the **UDID** (unique device identifier) of each target device
2. Register UDIDs in your Apple Developer account
3. Create an Ad Hoc provisioning profile that includes those UDIDs
4. Build and sign the `.ipa` with that profile
5. Distribute the `.ipa` file via a link, MDM, or a service like Diawi or AppCenter

**Limitation:** The 100-device limit resets annually. Getting UDIDs from clients is awkward. Does not scale.

---

### Method 5 — Custom App (Apple Business/School Manager)

| | |
|---|---|
| **Who can download** | Specific organizations that you invite |
| **Apple review required** | Yes — same as App Store review |
| **Device limit** | Unlimited |
| **Requires Developer Program** | Yes ($99/yr) |
| **Best for** | B2B apps distributed to client companies, employee apps deployed via MDM |

**How it works:** App is submitted and reviewed like a public app, but instead of going public you assign it to specific organizations via their **Apple Business Manager** or **Apple School Manager** account. The receiving organization's IT team deploys it via Mobile Device Management (MDM) software.

**Limitation:** The client organization must have an Apple Business Manager account (free but requires enrollment). Requires some IT coordination on the client side.

---

### Method 6 — Apple Developer Enterprise Program

| | |
|---|---|
| **Who can download** | Internal employees of the enrolling organization only |
| **Apple review required** | No (Apple does not review the app) |
| **Device limit** | Unlimited |
| **Requires Enterprise Program** | Yes ($299/yr) |
| **Best for** | Large companies distributing internal apps to their own workforce |

**Important restrictions:**
- Strictly for **internal use only** — distributing to external clients or the public violates Apple's Terms of Service and can result in **certificate revocation** (all your apps instantly stop working on all devices)
- Apple audits usage — misuse is taken seriously
- Not appropriate for client delivery unless you are the employer of those clients

---

## 6. Decision Guide

```
Q: Who needs to install the app?
│
├── General public, no restrictions
│   └── → PUBLIC APP STORE
│
├── Specific clients or users, no IT/MDM on their end
│   ├── Permanent access needed
│   │   └── → UNLISTED APP (best beginner-friendly option)
│   └── Temporary / beta testing only (< 90 days per build)
│       └── → TESTFLIGHT
│
├── Small team, you control the devices (< 100 devices/yr)
│   └── → AD HOC
│
├── Client company with IT / Apple Business Manager
│   └── → CUSTOM APP
│
└── Your own company's internal employees only
    └── → ENTERPRISE PROGRAM
```

---

## 7. Recommended Path for a Beginner Delivering to Clients

**Start with TestFlight** during development — it's the fastest way to get a build to testers without dealing with device registration. The beta review is less strict and turnaround is fast.

**Graduate to Unlisted App** for production delivery to clients:
- One-time App Store review (same process as a public app)
- No device limits
- No client IT setup required — just send them the link
- App stays on the App Store permanently (no expiry)
- You can update it like any App Store app

**What you will need:**
1. Apple Developer Program membership ($99/yr)
2. Xcode (free, Mac required)
3. App Store Connect account (free with Developer Program)
4. Privacy policy URL (a simple one-page website suffices)
5. App icons and screenshots ready

---

## 8. Key Resources

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/) — track SDK deadlines
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [TestFlight Overview](https://developer.apple.com/testflight/)
- [Unlisted App Distribution](https://developer.apple.com/support/unlisted-app-distribution/)
- [Apple Developer Enterprise Program](https://developer.apple.com/programs/enterprise/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [iOS App Distribution Guide 2026 (Foresight Mobile)](https://foresightmobile.com/blog/ios-app-distribution-guide-2026)
- [App Store Review 2026 (The App Launchpad)](https://theapplaunchpad.com/blog/app-store-review-guidelines)

---

*Research compiled 2026-03-29. Apple requirements change regularly — always verify against the official developer.apple.com documentation before submitting.*
