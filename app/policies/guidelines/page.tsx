import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Creator guidelines" };

export default function GuidelinesPage() {
  return (
    <>
      <h1>Creator guidelines</h1>
      <p>Tips for sharing creations that other bookers will enjoy, and that pass review quickly.</p>

      <h2>Make it easy to find</h2>
      <ul>
        <li>Use a clear title and a one-line summary that says what&apos;s inside (for example, “12-wrestler indie roster with two tag titles”).</li>
        <li>Add a few tags players might search for: era, style, region, roster size.</li>
        <li>Pick the narrowest category that fits. Share a whole promotion instead of a universe if that&apos;s all players need.</li>
      </ul>

      <h2>Choose the right package</h2>
      <ul>
        <li><strong>Scenario</strong>: rosters, titles, storylines and upcoming shows, without past results. Best for “start here” setups.</li>
        <li><strong>Universe</strong>: everything including history. Large histories may exceed the 4 MB sharing limit.</li>
        <li><strong>Single items</strong>: a wrestler, team, championship, promotion, storyline or venue that players can drop into their own universe. Imports let players rename or link duplicates.</li>
      </ul>

      <h2>Images</h2>
      <ul>
        <li>Only upload art you made or have permission to share. No photos of real people, real logos or belts.</li>
        <li>Creations with images are reviewed before they appear; text-only creations usually publish immediately.</li>
        <li>Images count toward your storage. If you&apos;re out of space, publish without images.</li>
      </ul>

      <h2>Updating</h2>
      <ul>
        <li>Publish a new version from the same universe to keep your ratings, downloads and link. Add a short note on what changed.</li>
        <li>Players can import any earlier version from your creation&apos;s page.</li>
        <li>Set a creation to draft to hide it without deleting it. Drafts don&apos;t count toward your active creation limit.</li>
      </ul>

      <h2>Ratings and reports</h2>
      <ul>
        <li>Each player can rate a creation once (they can change their rating). You can&apos;t rate your own work.</li>
        <li>Don&apos;t ask for ratings in exchange for anything, and don&apos;t use extra accounts. Manipulation leads to removal.</li>
        <li>Report content that breaks the <Link href="/policies/content">content policy</Link>. Don&apos;t report things just because you dislike them.</li>
      </ul>
    </>
  );
}
