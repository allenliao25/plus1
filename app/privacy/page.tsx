import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · plus1",
  description: "How plus1 collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-lvh overflow-y-auto bg-white px-5 py-10 text-zinc-950">
      <article className="mx-auto max-w-[42rem] leading-relaxed">
        <h1 className="text-2xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-sm text-zinc-500">Effective July 6, 2026</p>

        <p className="mt-6">
          plus1 is operated by Allen Liao. This policy explains what data the
          app collects, how it is used, and the choices you have.
        </p>

        <h2 className="mt-8 text-lg font-bold">Data we collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Phone number</strong>, used to sign you in and secure your
            account.
          </li>
          <li>
            <strong>Profile information</strong> you provide: name, handle, bio,
            interests, and profile photo.
          </li>
          <li>
            <strong>Content you create</strong>: events, messages, and any
            images you upload.
          </li>
          <li>
            <strong>A coarse area</strong> (a general locality string) so we can
            show events near you. We do not collect precise GPS location.
          </li>
        </ul>

        <h2 className="mt-8 text-lg font-bold">How we use your data</h2>
        <p className="mt-2">
          We use your data only to provide the service: signing you in, showing
          you nearby events, letting you create and join events, and enabling
          messaging. We do not use your data for advertising or profiling.
        </p>

        <h2 className="mt-8 text-lg font-bold">Sharing</h2>
        <p className="mt-2">
          We do not sell your data. Your data is stored with our backend
          provider, Supabase, which processes it on our behalf to run the app.
          Profile details and event content you post are visible to other users
          as part of using the app.
        </p>

        <h2 className="mt-8 text-lg font-bold">Retention and deletion</h2>
        <p className="mt-2">
          We retain your data until you delete your account. You can delete your
          account at any time from Profile → Settings in the app. Deleting your
          account permanently removes your profile, events, messages, and
          related data.
        </p>

        <h2 className="mt-8 text-lg font-bold">Contact</h2>
        <p className="mt-2">
          Questions about your privacy? Email{" "}
          <a className="font-semibold underline" href="mailto:allen8@stanford.edu">
            allen8@stanford.edu
          </a>
          .
        </p>
      </article>
    </main>
  );
}
