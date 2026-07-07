import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · plus1",
  description: "The terms that govern your use of plus1.",
};

export default function TermsPage() {
  return (
    <main className="min-h-lvh overflow-y-auto bg-white px-5 py-10 text-ink">
      <article className="mx-auto max-w-[42rem] leading-relaxed">
        <h1 className="text-2xl font-extrabold tracking-tight">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted">Effective July 6, 2026</p>

        <p className="mt-6">
          plus1 (&quot;the app&quot;) is operated by Allen Liao. By creating an
          account or using plus1 you agree to these Terms of Service. If you do
          not agree, please do not use the app.
        </p>

        <h2 className="mt-8 text-lg font-bold">Eligibility</h2>
        <p className="mt-2">
          You must be at least 17 years old to use plus1. By using the app you
          confirm that you meet this age requirement.
        </p>

        <h2 className="mt-8 text-lg font-bold">Your content and conduct</h2>
        <p className="mt-2">
          plus1 lets you create events, send messages, and share profile
          details and images. You are responsible for the content you post. We
          have a <strong>zero-tolerance policy for objectionable content and
          abusive behavior</strong>. You may not post content that is unlawful,
          threatening, harassing, hateful, sexually explicit, or otherwise
          objectionable, and you may not use the app to abuse, harass, or harm
          other people.
        </p>
        <p className="mt-2">
          Every user can report content and block other users from within the
          app. We review reports of objectionable content and abusive behavior
          within 24 hours and remove content or eject the users who posted it.
          We may remove any content and suspend or terminate any account at our
          discretion, including for violations of these terms.
        </p>

        <h2 className="mt-8 text-lg font-bold">Account deletion</h2>
        <p className="mt-2">
          You may delete your account at any time from Profile → Settings in the
          app. Deleting your account permanently removes your profile, events,
          messages, and related data.
        </p>

        <h2 className="mt-8 text-lg font-bold">Disclaimer</h2>
        <p className="mt-2">
          plus1 is provided &quot;as is&quot; without warranties of any kind. We
          are not responsible for the conduct of other users or for events
          organized through the app. Use good judgment when meeting people in
          person.
        </p>

        <h2 className="mt-8 text-lg font-bold">Governing law</h2>
        <p className="mt-2">
          These terms are governed by the laws of the State of California,
          without regard to its conflict-of-law rules.
        </p>

        <h2 className="mt-8 text-lg font-bold">Contact</h2>
        <p className="mt-2">
          Questions about these terms? Email{" "}
          <a className="font-semibold underline" href="mailto:allen8@stanford.edu">
            allen8@stanford.edu
          </a>
          .
        </p>
      </article>
    </main>
  );
}
