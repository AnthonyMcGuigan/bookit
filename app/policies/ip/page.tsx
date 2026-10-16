import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { submitTakedownAction } from "@/features/moderation/actions";

export const metadata: Metadata = { title: "IP & takedowns" };

export default function IpPolicyPage() {
  return (
    <>
      <h1>Intellectual property &amp; takedown requests</h1>
      <p>
        We respect the rights of wrestlers, promotions, artists and other creators. Community creations must not use protected names, likenesses, logos, artwork or music in a way that infringes those rights.
        Official game content is fictional and doesn&apos;t include real-world wrestler portraits, company logos or music.
      </p>

      <h2>What happens when you file a request</h2>
      <ul>
        <li>If your request links to a community creation, it&apos;s hidden right away while moderators review the request.</li>
        <li>A moderator checks the request and either removes the content, rejects the request, or records a counter-notice from the creator.</li>
        <li>The creator sees the decision and the reason, and may appeal. Repeat infringers lose publishing access.</li>
        <li>Moderators reply to you at the email address you provide. Requests are kept for our records.</li>
      </ul>

      <h2>File a request</h2>
      <p>You must be the rights owner or authorised to act for them. Knowingly false requests may have legal consequences.</p>
      <Card className="p-4 not-prose">
        <ActionForm action={submitTakedownAction} submitLabel="Submit request" resetOnSuccess testId="takedown-form">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Your full name" htmlFor="claimantName"><Input id="claimantName" name="claimantName" required minLength={2} maxLength={120} autoComplete="name" /></Field>
            <Field label="Email" htmlFor="claimantEmail"><Input id="claimantEmail" name="claimantEmail" type="email" required maxLength={200} autoComplete="email" /></Field>
            <Field label="Organisation (optional)" htmlFor="claimantOrganization"><Input id="claimantOrganization" name="claimantOrganization" maxLength={120} autoComplete="organization" /></Field>
            <Field label="You are" htmlFor="relationship">
              <Select id="relationship" name="relationship" defaultValue="owner">
                <option value="owner">The rights owner</option>
                <option value="authorized_agent">Authorised to act for the owner</option>
              </Select>
            </Field>
          </div>
          <Field label="The work you own" htmlFor="workDescription" hint="Describe the protected work and how it's being used.">
            <Textarea id="workDescription" name="workDescription" rows={4} required minLength={10} maxLength={4000} />
          </Field>
          <Field label="Link to the content" htmlFor="infringingUrl" hint="For example, the address of the community creation page.">
            <Input id="infringingUrl" name="infringingUrl" required minLength={5} maxLength={500} />
          </Field>
          <div className="hidden" aria-hidden>
            <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <Checkbox name="goodFaith" required label="I believe in good faith that this use is not authorised by the rights owner, its agent or the law." />
          <Checkbox name="accuracy" required label="The information in this request is accurate, and I am the rights owner or authorised to act for them." />
          <Field label="Electronic signature (type your full name)" htmlFor="signature"><Input id="signature" name="signature" required minLength={2} maxLength={120} /></Field>
        </ActionForm>
      </Card>
      <p className="text-xs text-muted">Operators: replace this text with your registered agent details and local legal requirements before launch.</p>
    </>
  );
}
