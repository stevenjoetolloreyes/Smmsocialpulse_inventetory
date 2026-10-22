import LegalShell from "@/components/LegalShell";

export const metadata = { title: "Privacy Policy · Inventory Management System" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="October 2026">
      <p>
        The Inventory Management System is a point-of-sale and inventory tool run by
        an individual store (the &ldquo;store owner&rdquo;) for their own business.
        This page explains what information the system stores and how it is used.
      </p>

      <h2>Information the system stores</h2>
      <p>
        Everything in the system is business data entered by the store: product and
        stock records, batches and expiry dates, supplier details, receiving
        records, sales and returns, and an activity history. Staff accounts store a
        name, username, email address, a securely hashed password (never the plain
        password), role, and last sign-in time.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Data lives in the store owner&apos;s own database, connected to their own
        deployment of this system. The store owner controls that database and is
        responsible for it. The system does not send store data to the developer or
        to any advertising or analytics service.
      </p>

      <h2>Cookies</h2>
      <p>
        The system uses one essential cookie: a signed session cookie that keeps a
        staff member signed in for up to seven days. It contains no personal
        profile information and is never used for tracking across other websites.
        No advertising or analytics cookies are used.
      </p>

      <h2>How information is used</h2>
      <p>
        Stored information is used only to run the store: completing sales,
        tracking stock, producing reports, and recording which staff member
        performed each action. Sales history is kept as the store&apos;s own sales
        records. Information is not sold or shared with third parties for
        marketing.
      </p>

      <h2>Your choices</h2>
      <p>
        Staff members who want their account details corrected or removed should
        ask the store owner, who can edit or deactivate accounts in Settings →
        User Management. Because the database belongs to the store owner, requests
        about stored business records should also be directed to them.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes, the updated text will be posted on this page with a
        new &ldquo;last updated&rdquo; date.
      </p>
    </LegalShell>
  );
}
