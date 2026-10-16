import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Content policy" };

export default function ContentPolicyPage() {
  return (
    <>
      <h1>Content policy</h1>
      <p>
        This game is a fictional wrestling booking simulator. Everything in your private universes is yours and visible only to you.
        This policy covers what you share in the community library: creations, descriptions, tags, images and creator profiles.
      </p>

      <h2>Fictional by default</h2>
      <p>
        The starter universe and all official content are fictional. Community creations should be original or clearly marked as fan content.
        Similarity to real people or companies in official content is unintended.
      </p>

      <h2>Fan content</h2>
      <p>Fan content (creations inspired by real wrestlers, promotions or events) is allowed as text only, as long as you:</p>
      <ul>
        <li>tick “This is fan content” when publishing, so it is labelled as an unofficial tribute;</li>
        <li>don&apos;t upload photos or likenesses of real people, company logos, title belt photography, trademarks, music or other protected artwork;</li>
        <li>don&apos;t present it as official, endorsed or affiliated with any real person or company;</li>
        <li>don&apos;t include defamatory claims, private information or content that mocks real people for their identity.</li>
      </ul>
      <p>Rights holders can ask for fan content to be removed at any time through the <Link href="/policies/ip">IP takedown process</Link>.</p>

      <h2>Not allowed</h2>
      <ul>
        <li>Content you don&apos;t have the right to share, including other creators&apos; work without permission when remixes aren&apos;t allowed.</li>
        <li>Unlicensed real-world portraits, logos, music or artwork, even if cropped or edited.</li>
        <li>Harassment, threats, hateful content or content targeting real people or groups.</li>
        <li>Sexual content, or content that sexualises anyone.</li>
        <li>Promotion of real-world violence. In-ring storyline violence between fictional characters is fine.</li>
        <li>Impersonation of other creators, moderators or companies.</li>
        <li>Spam, misleading titles, or files designed to break the game.</li>
        <li>Personal information such as addresses, phone numbers or account details.</li>
      </ul>

      <h2>How moderation works</h2>
      <ul>
        <li>Every package is validated by the server before it is stored. Uploaded images are re-encoded and stripped of metadata.</li>
        <li>Creations with custom images, or text that matches review terms, are checked by a moderator before they appear.</li>
        <li>Reports are reviewed by moderators. Intellectual-property reports, or several reports on one creation, hide it until it is reviewed.</li>
        <li>Moderators can approve, reject, hide or remove creations, and restrict accounts from publishing. Every decision includes a reason that you can see under <Link href="/account/moderation">Account → Moderation</Link>, and every decision is recorded in an audit log.</li>
        <li>You can appeal a decision, one open appeal per creation at a time. If the appeal is upheld, the creation is restored.</li>
        <li>Restrictions affect community features only. You never lose access to your private universes.</li>
      </ul>

      <h2>Remixes and credit</h2>
      <p>
        If a creator allows remixes, you may import their creation, change it and publish your version. The game records the original automatically and shows it on your creation&apos;s page.
        Creators can turn remixes off for future publications.
      </p>

      <p className="text-xs text-muted">
        Operators deploying this game should review this policy with their own legal counsel and update it for their jurisdiction before opening the community to the public.
      </p>
    </>
  );
}
