# Book It: Wrestling Booking Sim

(Formerly Book It. Saves carry over: the storage keys still use the old name.)

An original pro wrestling booking simulator for phones. You run a fictional promotion: book weekly shows, write storylines, manage contracts and money. All wrestlers, titles and events are made up.

## Play it

**Quickest:** open the hosted link on your phone and start playing. Saves stay in that browser.

**Install it as an app (home screen icon, works offline):**
1. Put this whole folder on any HTTPS static host (GitHub Pages, Netlify Drop, Cloudflare Pages). Netlify Drop is the easiest: drag the folder onto app.netlify.com/drop.
2. Open the URL on your phone.
3. iPhone: Share → Add to Home Screen. Android: menu → Install app.

**On a computer:** in this folder run `python3 -m http.server 8000` and open http://localhost:8000. Opening `index.html` directly also works (no offline install in that case).

## Going public (v1.0)

There are two ways to let people play. You can use both.

**1. Share the hosted link (has Community).** Open the game on claude.ai and use its **Share** menu to choose who can open it. People who can only view can play, browse Community and download rosters. To let people post to Community, give them contributor (interact) access. You're the owner, so you can remove any post from its page. Saves stay in each player's own browser.

**2. Host your own copy (installable, works offline, no Community).** Unzip `ringside-booker-web.zip` and drag the folder onto app.netlify.com/drop, or put it on GitHub Pages or Cloudflare Pages. Players get a normal web link and can add the game to their home screen. Community falls back to share codes.

Launch checks done for v1.0:
- A fresh player can get through setup, the draft and a first show at 320px, phone, tablet and desktop sizes, in light and dark mode, with no errors and no sideways scrolling.
- Crash screen: if anything breaks, players see Reload / Main menu / Keep playing instead of a blank page.
- Damaged saves are copied to a `.damaged` key instead of being lost.
- Menu → About shows the version and the fan-made disclaimer. Community sharing shows house rules.
- Offline cache is bumped to v2, so returning players get the update.
- Link previews are set for the self-hosted copy. The debug hook only turns on under automated tests or with `?debug`.

The shipped game has fictional names only. The fan-made AEW roster lives on the hosted Community board. A copy is in `community/aew-roster.json`, and it is not in the zip.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game: one file, no libraries, about 100 KB. Loads instantly. |
| `manifest.webmanifest`, `sw.js` | Make it installable and playable offline. |
| `icons/` | App icons. |

## First time playing

A new player gets a short welcome sequence instead of a blank screen:
1. **Your company:** name, flagship show, show night and brand color (with a live logo preview and name ideas).
2. **Budget:** Indie startup (hard), Regional (normal) or Network-backed (easy). This sets your bank and payroll cap.
3. **Roster:** run a draft, import your own roster, or take the ready-made starter roster.
4. **The draft:** 16 picks against two rival promotions who pick after you. A payroll bar and "needs" chips (main eventers, faces, heels, high flyer, talkers) keep you on track, and **Auto-pick** or **Auto-draft the rest** do it for you. Undrafted wrestlers become free agents.
5. **Champions and first story:** crown your first champions (suggestions are filled in) and start a first storyline.
6. Your first show opens with three quick tips on the booking screen.

Existing saves skip this. To run it again, choose **Start a new company** from the main menu.


The home screen is the first thing a new player sees. It has a Continue card for the latest save, a "Jump into a universe" shelf of Community save files (featured first, tap one and pick a slot), and two ways to start your own: a new company (the setup wizard) or restoring a backup. On a self-hosted copy without Community, the shelf offers to paste a shared save instead.

## How a week works

1. The **Shows** screen is the heart of the game: a month calendar of your shows with the match card for the selected week right below it. Past weeks show results, tonight and future weeks can be booked (you can book big events weeks ahead). Every match shows a projected star rating, and the projected show score sits at the top.
   Tap **Briefing** for what needs your attention: expiring contracts, unhappy or injured wrestlers, cooling storylines, idle champions, story ideas.
2. **Book** the card: add matches (12 participant types from singles and handicaps to 40-person rumbles, plus 14 gimmicks on top; make your own of both in Menu → Match types; pick the winner and one of 9 finishes, add a run-in or a mid-match turn, put a title on the line), promos and angles (attacks, heel/face turns, contract signings, debuts). Or tap **Auto-fill** or **Copy last** and tweak it. The last segment is the main event. Rumbles and battle royals are roster-wide: anyone from any show can enter, even if they wrestled earlier that night. Each big event can have a signature match that goes on its card automatically; fans expect it.
   While you book, each match shows warnings (same alignment, rematch, tired, needs a target), and the card tells you if your best segment isn't the main event. In Reorder, **★ Main event** moves a segment to the end in one tap. Picking wrestlers jumps straight to the next empty side, and story rivals and good opponents are listed first.
3. **Run the show.** The results open with the headlines (title changes, story payoffs, injuries, departures) and show who was in every segment. Each segment gets a star rating with a plain-English breakdown of why. Big events add a **Month in review**: average rating, fans, profit, best segment and star of the month.
4. Handle contracts and free agents in the **Office**.

Every 4th week is a **big event** (configurable). Big events earn far more and pay off storylines: if both sides of a story wrestle each other there, the story ends and the winners get a popularity jump based on its heat.

## Features

- **Plan the PPV first:** while the next big event has no card, a "Step 1 · Plan the big event first" panel sits at the top of tonight's show with a button to book it. A booked-ahead PPV shows a note that it's the announced card and can still change. If a storyline gets hotter than the weakest announced match, the Road to panel offers to add it to the PPV with a head start on hype.
- **Road to the PPV:** book a big event weeks ahead and its matches become the announced card. A "Road to" panel under each weekly show lists them with hype meters and one-tap "+ Face-off" buttons. Weekly segments with both sides build hype (one side builds a little), and ignored matches cool off. At the PPV, hype adds up to +12 to a match and raises pay-per-view buys. The Briefing warns when a PPV close by has no card, has an injured headliner, or has low hype. There is also a weekly goal type for building hype.
- **Game layer:** live show night (segments come in one by one with star ratings, crowd chants, title-change and confetti moments, then the final score, goals and trophies). Booker rank from XP (6 ranks, about two in-game years to the top). One or two weekly goals with XP and fan rewards. Nine kinds of backstage moments with choices (brawls, viral clips, surprise visitors, injury scares, buyout offers, dream-match demands, mentors, gimmick pitches, a TV exec visit). 13 trophies.
- **Winners and records:** pick the winner of any match or call it a draw, and pick who comes out on top in promos and angles with a target. Every wrestler has a W–L–D record, last-5 form, streaks, and career stats (matches, average and best rating, title wins, defenses, match of the night). Records feed the sim: streaks add crowd interest, snapping a 5+ streak is a big moment, losing runs hurt popularity, and contender rankings (Office → Titles) reward giving the #1 contender their shot. The roster can be sorted by wins, win % or streak.
- **Contracts:** real-world lengths (3 months to 5 years, one show a week). Each wrestler prefers a length by career stage: stars want 3 years, solid hands 2, rising talent and veterans 1. Short deals cost more per week and long ones get a small discount. Talks open 12 weeks before a deal ends, and re-signing earlier takes 10%+ over their price. In the last 8 weeks rivals may court bigger names, which raises their price. When a deal ends they may work 4 weeks on a handshake, sign with the rival, or become a free agent. Also: a live "will they say yes" meter, releases with a buyout, and morale.
- **Optional money and contracts:** both can be switched off on the "How do you want to run it?" step of the welcome sequence, or later in Menu → Settings. With money off there is no bank, payroll or profit to watch. With contracts off there are no salaries or expiring deals: signing is instant and wrestlers stay until you release them.
- **Storylines:** two-sided feuds with heat that rises when both sides share a segment and cools when ignored, a running story log, optional title tie-in, story suggestions.
- **Notes to keep up:** to-do list, free-form notebook, filterable news log, full show history with recaps, and a notes box on every wrestler and storyline.
- **Saves:** auto-save after every action, 3 save slots, backup by file download or copy/paste text.
- **Freedom:** edit any wrestler's stats and alignment, create wrestlers and championships, set champions directly, rename the promotion, shows and big events, choose any winner, switch off injuries or money, set your bank balance.
- Wrestling arena look: ring-rope stripes, spotlights, fight-poster type (Anton and Barlow Condensed from Google Fonts, falling back to system fonts offline), title-belt badges, VS badges, a gold main event and premium-event banner, face/heel rings on avatars, and a bell when a show starts.
- Dark and light themes, built for one-handed phone use.
- **Titles** have a division (Men's, Women's or Open) and contender rankings per title. Pick up to 3 contenders yourself in the title editor; the rest rank by record, and lesser titles skip people already chasing a bigger belt.
- Minimal line icons (an inline SVG sprite, no emoji) and short, plain wording throughout.

## Character builder, rosters and Community

- **Character builder** (Roster → Build): photo (turn any photo into a pixel character, with framing, detail, colors, and background options; it runs on the device and only the pixel version is saved), color, nickname, division, hometown, height/weight, finisher, signature move, entrance theme, bio, rating sliders with a live overall, and archetype presets (Rookie to Legend).
- **Roster tools** (Roster → Import / export): paste a share code, a save file, or a plain list from a spreadsheet (one wrestler per line, only the name is required). Add them to your roster, as free agents, or replace your whole roster. Export gives a share code or a spreadsheet-ready copy. A new game can start with **Build or import my own roster** for a blank promotion.
- **Community** (Roster → Community): browse and add other players' shared rosters and wrestlers, share your own, and delete your uploads. It runs on the hosted claude.ai version; who can see and post depends on how the page is shared (Viewers browse and download, Contributors can also post, the owner can remove anything). The self-hosted copy falls back to share codes.
- **Shared save files** (Community → Share → Save file): share your whole universe (roster, titles, storylines, records, the last 24 shows) so others can play on from where you are. Saves are trimmed and gzipped (a 60-week game is about 20 KB), your notes are left out unless you tick the box, and each player can have 3 shared at once. Others browse them under the Saves filter and pick a save slot to play in. Shared saves are sanitized on load.
- **Creator accounts** (Community → My profile): your account is your claude.ai sign-in, so there is no password. Set a display name, a short bio and a color. Like creations (❤️), follow creators, and open any creator's page to see their uploads, likes and followers. Browse sorts by Popular (likes and plays), New or Following, and each item shows how many players are playing or added it. Profiles, likes, plays and follows live in each player's own Community space (`creations/{id}`: `profile`, `likes`, `used`, `follows`), so no extra access rules are needed. Uploads and removals keep the other fields. The owner can clear a profile, or use **Remove all** on a creator page to wipe that player's whole space. Everything read from other players' spaces is checked: likes, plays and follows must be plain ids (a bad entry can't break the board for everyone), names that pose as the game, the owner or "You" are hidden, and hidden or right-to-left characters are stripped. When the owner removes something from another player's space, only the known fields are written back, so a stuffed space can't block removal. Likes and follows are public to everyone who can open the page.
- The game ships with fictional wrestlers only. Players type in or import any roster they want, including real-world ones.

## Teams, tournaments, history and rankings

- **Tag teams and stables** (Roster → Teams): 2 to 4 members, a team name and a team record. Members booked on the same side get a chemistry bonus that grows with the team's wins, the results use the team name, and the wrestler picker has one-tap team buttons in tag matches. (`G.teams`)
- **Factions** (Roster → Teams & factions): up to 8 members, an optional leader, and whole tag teams inside them. Any 2+ members on one side fight as the faction: a chemistry bonus that grows with faction wins, a faction record, the faction name in results, a bonus for faction vs faction, and one-tap picks in the wrestler picker. A team inside a faction still uses its own team bonus (+1). Auto-fill sometimes books faction six-person tags. (`G.factions`)
- **Tournaments** (Office → Titles → Run a tournament): 4, 8 or 16 wrestlers, seeded in pick order or filled from the top contenders. The winner takes a vacant title (the final is for the belt), earns a title shot (#1 contender), or gets bragging rights. Each round is added to a show from a card on the Shows screen, anyone who leaves gives a walkover, and the bracket view shows every result. (`G.tourneys`)
- **Title history:** every reign with start and end week, length and defenses, the longest reign and the most reigns, shown in the title editor, in Menu → History, and as "Title reigns" on each wrestler. (`title.reigns`)
- **Rankings** (Roster → Rankings): the champion plus the top 10 per division and the top teams, with movement arrows since the last show.
- **Year-end:** at week 52, 104 and so on the awards are handed out (Wrestler of the Year, Women's Wrestler of the Year, Match, Show, Feud and Tag Team of the Year, Breakout Star). Everyone ages a year: young talent improves, wrestlers over 34 slow down, and from 38 they may retire. Retired wrestlers become Legends and can be brought back. Aging can be switched off in Menu → Settings. (`G.awards`, `w.retired`)
- **Undo the last show** from the results, and **copy a card or results as text** to share anywhere.

## Rival promotions

Office → Rivals. Each rival has a roster, a champion, a weekly show with a rating, fans and prestige (`G.rivalPromos`). Every week they run a show, re-sign or release wrestlers, and sign free agents. When a rival outrates you, they take a few of your fans. Wrestlers who leave you, or who get bought out, join a real rival roster. You can create, edit and close rivals, copy a rival's share code, or try to sign their wrestlers (buyout plus a chance based on prestige). Any roster from a share code, a pasted list or Community can be imported as a rival with "Make it a rival promotion". The draft's two rivals become real promotions with the wrestlers they picked. Older saves get rival rosters generated on first use.

## Rivals fight back, promo plans, backstage politics, cloud saves (v1.6)

- **Rival cards**: every week each rival books a real card (`rivalCard()`, stored in `r.card`): a title main event and three or four matches. Results move momentum and can change their champion. See the last card in the rival's page.
- **Loaded shows**: two weeks before your big event, the biggest rival may announce a loaded show against it (`r.counter`). That night they rate about 8 points higher, and the fan swing is doubled both ways. It shows up in the news and the Briefing.
- **Rival moves (random backstage events)**: a rival tries to lure a top star mid-contract (match the offer, hold them to the deal, or take a buyout), trade offers for a similar wrestler, and invasions: two rival wrestlers join for 8 weeks (`w.loan`, `w.loanUntil`) with an "Invasion" storyline, then go home.
- **Promo plans**: each promo has a topic (`seg.topic`: title, personal, crowd, last loss, brag) and a tone (`seg.tone`: fiery, calm, funny, cheap heat, from the heart). The topic needs the right situation, and the tone is a skill check on mic and charisma: it lands or falls flat. The editor says how likely it is to land.
- **Backstage politics (random events)**: a star refuses to lose (change the finish, hold firm, or let the match decide), creative control (`w.creative`: they may change a finish where they lose), a locker room leader (`G.leader`: everyone's mood drifts with theirs), cliques, and no-shows.
- **Cloud saves** (Supabase copy only): Menu → Cloud saves keeps up to 3 games in rows `cloud1`..`cloud3`, readable only by their owner. Auto backup uploads after every week. Players add their email to load them on another device. **Re-run `supabase/setup.sql` once** so the database accepts the new rows.

## Wrestler personalities (optional)

Turn it on at game setup (step 2, Game rules) or in Menu → Settings. New games start with it on; older saves start with it off. With it off, nothing below runs.

- **Personalities** (`w.pers`): Glory hound, Loyal, Hothead, Money first, Spotlight seeker, Team player. Picked from each wrestler's style, age and popularity, and you can change one on their profile. Each takes wins, losses, promos and time off TV differently.
- **Texts** (`G.phone`, the phone button at the top): wrestlers react after shows (a title win, a loss at a big event, a first main event, a great promo) and when contract talks open. About one or two texts a week.
- **Asks and promises** (`G.promises`): some texts ask for something: a main event, a title shot, a win, a promo, TV time, a rematch or a raise. Promise it and you get a deadline, which shows in the Briefing. Keep it and trust goes up. Break it, say no or ignore the text, and they remember.
- **Memory and trust** (`w.trust` 0–100, `w.mem` last 8 moments): their profile shows what they remember, including how you handled their backstage events. Trust nudges their mood, how easily they re-sign, and whether they walk to a rival who is courting them. Their texts change with it too.

## Storylines that grow on their own

After each show the game looks for a moment worth a story and starts at most one: a dethroned champion wants a rematch, a broken win streak wants revenge, an attack on a recent tag partner becomes a betrayal, a draw or an 82+ match leaves unfinished business, and two people who meet 3 times in 4 shows become a feud. It shows up in the news and the results. Switch it off in Menu → "Stories start on their own".

## Navigation (v1.5.1)

- **Office → Setup** holds the company setup: promotion and show names, other companies, shows and brands, big events and match types.
- **Menu** holds only save slots and backup, Settings (game rules, sound and display), Help, and leaving or deleting the save.
- Roster tools, Community and Rankings are on the Roster tab. History, awards and trophies are under Office → Titles.

## Security

- Everything a player can type or import is escaped before it reaches the page. Photos must be small PNG/JPEG/WebP data images and colors must be hex codes.
- Saves from outside this browser (pasted, loaded from a file, or played from Community) go through `sanitizeGame()`. It rebuilds the save as plain data, keeps ids to letters, numbers, `-` and `_`, strips markup characters, turns numbers back into numbers, and only allows known values for fixed choices like match type. Shared saves are capped at 8 MB unpacked.
- Community only reads the first 25 items per player. Players can only write their own document, and the owner moderates.
- The spreadsheet export prefixes cells that start with `= + - @`, so they can't run as formulas.
- The self-hosted copy ships a Content-Security-Policy (no outside scripts or images, and connections only to this game's own Supabase project). The service worker caches only this site's own good responses.
- Save and roster files over 8 MB are refused before they are read, so a huge file can't freeze the page.
- Supabase (`supabase/setup.sql`, v1.5.1): each row is capped at 400 KB of real JSON text (the old cap measured the compressed size), and the server sets the `updated` time so nobody can pin a post to the top of Community with a future date. Re-run `setup.sql` in the SQL Editor once to add these.
- v1.5.1 security pass: every tab and two levels of buttons were rendered with booby-trapped names, notes, titles, shows, match types and Community posts; nothing ran.

## Packaging for the app stores (optional, later)

The game is plain HTML/JS, so it can be wrapped with Capacitor (`npx cap init`, copy this folder into `www/`, then `npx cap add ios` / `android`) to produce App Store and Play Store builds.

## Support page (donations)

Menu → ❤️ Support the game (also on the home screen and in About). It links out to a tip page; payments never happen inside the game and tips unlock nothing.
- **Hosted copy:** open the Support page as the owner, paste your link (Ko-fi, Buy Me a Coffee, Patreon, PayPal.me, Liberapay, GitHub Sponsors, Stripe and a few others) and tap Save. It is stored on the Featured Community doc (`support: {url, note}`), so every player sees it right away with no republish. Only https links on known tip sites are accepted.
- **Self-hosted copy:** set `SUPPORT_URL` near the top of the Community code in `index.html`.

## Photos: private imports and placeholders

Roster → Import → **Photos** tab.
- **Private photos:** pick many images at once, named after the wrestler (`Kenny Omega.jpg`, `will-ospreay_headshot.png` also match). Each becomes a pixel character on the device and is marked `photoLocal`. Private photos are left out of share codes, Community uploads and shared saves (`toPackW`, `shareableSave`), and only live in that save in that browser. Remove them all with one button.
- **Placeholders:** generic pixel wrestlers drawn at random on the device (`placeholderPic`: skin, hair, facial hair, masks, paint, gear in the wrestler's color). Not anyone real, so they share like any picture. Fill everyone without a photo, reroll them, or remove them. The builder also has "Use a placeholder".

## Version 1.1: release polish

- **Featured is fictional.** The real-company rosters were taken out of Featured before public release (backup: `community/featured-real-backup.json`). Featured now holds an original universe save, a 58-wrestler original roster and a free-agent class.
- **Moderation.** 🚩 Report on posts and creator pages. Reports go to `reports/{playerId}` (only the owner can read them), and the item is hidden for the reporter right away. The owner gets an **Inbox** tab in Community with Reports (view, remove post, remove all from creator, dismiss) and Feedback. A rude-word filter (`RUDE_RE`, leetspeak-aware) blocks posting and masks titles, descriptions, profiles and wrestler names read from Community.
- **Privacy & terms** page (menu, About, home, Community, reports, feedback).
- **Backups.** The hosted copy saves files through the viewer's `downloads` capability (it asks the player to confirm). A "Back up your save" bar appears on tonight's show after 8 weeks without a backup (Later snoozes 4 weeks).
- **Sound.** Web Audio, no files: bell, crowd pop scaled by rating, boos, main-event sting, title-change fanfare. Mute on the live screen or in the menu.
- **What's new** shows once per version for returning players (`WHATS_NEW`, `VERSION`).
- **Accessibility.** Text size (Small to Huge, `meta.text`, applied as page zoom with narrow-screen rules via `html[data-nw]`), motion setting (`meta.motion`, also follows the device), focus outlines, labelled controls, `aria-modal`, live toasts.
- **Feedback.** Menu → Send feedback, and "Send this crash to the maker" on the crash screen. Stored in `feedback/{playerId}` (owner-only).
- **Balance.** Fans level off toward a cap set by prestige (`fanCap`), TV money grows slower than the audience, and a **Challenge** setting (Relaxed / Normal / Tough) scales fan gains, income, injuries, rival pressure and contract asks. Five-year sims: Normal ends near 490k fans, Tough near 375k, Relaxed near 640k.

Hosted capabilities: `db` rules `creations` (read view, write owner), `creations/{self}` (read view, write interact), `reports` and `feedback` (read owner, write owner), `reports/{self}` and `feedback/{self}` (read interact, write interact); `user` with the profile scope; `downloads`.

## Version 1.2: deeper match booking

- **Nine finishes:** Clean, Submission, Roll-up, Cheating, Run-in, Screwjob, DQ, Count-out and No Contest. Each has its own effect on the rating, feud heat, and the winner's and loser's momentum and popularity. A roll-up keeps the loser strong; a screwjob makes fans feel for the loser.
- **Rules make sense:** no DQ or count-out in No DQ, Ladder, Steel Cage or Street Fight matches, and a Submission match only offers tap-out style endings. Old saves with "DQ / Count-out" become DQ.
- **Title rules:** a champion who loses by DQ or count-out keeps the belt.
- **Booking smarts:** cheap finishes in a big-show main event cost stars; a dirty finish on a weekly show keeps a feud going; a clean finish at a big show pays it off. Faces who cheat get booed; heels who cheat fit.
- **Run-ins:** pick who runs in to help the winner. Leave it empty and the winner's manager does it. A run-in with no history starts a new feud.
- **Turns during a match:** anyone in the match (or the run-in) can turn heel or face. Turning on a tag partner starts a Betrayal story. Turning again within 8 weeks is less believable.
- **Managers:** set one from a wrestler's profile. Managers talk for weak speakers in promos and add a little at ringside. Managers aren't included in shared Community packs.
- **Auto-fill** now mixes finishes: clean payoffs at big shows, dirtier finishes in hot weekly feuds, and heel champions sometimes keeping the belt by DQ.

## Version 1.4: brands, several weekly shows and one shared calendar

- Company setup (step 1) can add up to 3 more weekly shows, each with a name and night, and turn on the brand split right away.
- Menu → Weekly shows and brands: a company can run up to 4 weekly shows, each on its own night (like a Monday show and a Friday show).
- Brand split (optional): each show gets its own roster and its own titles, like separate brands. "Redo the brand draft" shares the roster out best-first, keeping tag teams together. Move a wrestler from their profile; pick each title's show in Weekly shows (or leave it shared).
- Big events take the main show's slot that week and can use everyone.
- A show and B shows: the main show is the A show. Other weekly shows are B shows with smaller crowds (up to 4,000), half a TV deal and higher production costs, so a second show adds money without doubling it. With the brand split on, every brand's show is an A show.
- Each extra show picked at setup adds 8 draft picks (with a bigger payroll budget) or 8 signings on the starter roster. The Briefing warns when a brand has fewer than 10 wrestlers.
- One calendar for the whole world: every show, across all your companies, runs in night order (Monday to Sunday). When a show is done the game moves you to the next one, so no company or brand can run ahead. The strip at the top of the Shows tab shows the week's order.
- Auto-book: tick it on a show you don't want to book yourself and it books and runs itself when its turn comes.
- Big event names are chosen when you set up a company (or left empty for Big Event 1, 2, 3...), so a new company never shows events you didn't name. Change them later in Menu.
- Older saves load as before: their one show becomes the main show.

## Version 1.3: several companies in one world

- New game: the welcome screen asks how many companies you'll run (1 to 4). Setup then runs once per company, back to back ("Company 2 of 3"). "Skip the rest" stops early.
- Menu → Your companies → Start another company in this world (up to 4).
- All companies share the free agents, rival promotions, titles calendar and week.
- Each company books one show a week. The week moves on after the last company runs. Auto-book the rest if you only care about one.
- Switch with the ⇅ button in the header or the company chips on the Shows tab.
- Shows on the same night split viewers. Stars whose deals end within 12 weeks can be lured from one of your companies to another.
- Shared save codes only carry the active company.

## Community on the live beta (Supabase)

The GitHub Pages copy keeps Community, likes, follows, reports and feedback in Supabase. The claude.ai copy still uses Claude's own storage.

- `SUPABASE_URL` and `SUPABASE_KEY` (the public publishable/anon key) sit next to `FEEDBACK_URL` in index.html. Leave them empty to turn Community off.
- Database: run `supabase/setup.sql` in the SQL Editor. One row per player per collection; row rules let players write only their own rows; moderators (table `admins`) can write any row and read reports and feedback.
- Supabase settings: allow anonymous sign-ins (players get a guest account), Site URL and Redirect URL = the game's address (for email sign-in links).
- Become the moderator: sign in with your email in Community → My profile, then run `insert into public.admins (uid) select id from auth.users where email = 'YOUR EMAIL';`.

## Public beta outside Claude (v1.2 beta)

The self-hosted copy (`ringside-booker-web.zip`) is the public beta. It works on any HTTPS static host, installs to the home screen and plays offline.

Before you upload, set these near the top of the Community code in `index.html` (search for `SUPPORT_URL`):
- `FEEDBACK_URL`: an https link to a feedback form or chat (Tally, Google Forms, Discord invite). Outside Claude, Send feedback and the crash screen copy the report and open this page. If it's empty, they only copy.
- `SUPPORT_URL`: your tip page (Ko-fi, Buy Me a Coffee, Patreon, PayPal.me and similar).
- `BETA`: set to `false` for the full release. It adds the "beta" label in About and What's new.

What beta players get: the full game, saves in their own browser, backups, share codes for rosters. What they don't get: Community, accounts, reports. Those live on the claude.ai copy only, because they need its database. The privacy page says so automatically.


## Sound credits

The show-night crowd uses short recordings from Wikimedia Commons. All are public domain or CC0, so no attribution is required, but here they are. They are trimmed, faded and volume-matched in `sounds/`.

| File | Source | License |
| --- | --- | --- |
| `sounds/cheer.mp3` | [Clapping hurray](https://commons.wikimedia.org/wiki/File:Clapping_hurray.ogg) by starlite | Public domain |
| `sounds/applause.mp3` | [Applause after a concert](https://commons.wikimedia.org/wiki/File:Sound_Effects_-_Applause_after_a_concert.ogg) by Amada44 | CC0 |
| `sounds/ooh.mp3` | [Ohhh ahhh](https://commons.wikimedia.org/wiki/File:Ohhh_ahhh.ogg) by starlite | Public domain |
| `sounds/boo.mp3` | [Audience Booing](https://commons.wikimedia.org/wiki/File:Soundgoats_-_Audience_Booing.wav) by Brendon (Soundgoats) | Public domain |

### Menu music

Three tracks by Kevin MacLeod rotate in the menus. They are CC BY 3.0, so the credit below must stay in the game (it is in About) and here. Volume-matched and re-encoded at 96 kbps in `sounds/`.

| File | Track | License |
| --- | --- | --- |
| `sounds/music-summon-the-rawk.mp3` | [Summon the Rawk](https://commons.wikimedia.org/wiki/File:Summon_the_Rawk_(ISRC_USUAN1200050).mp3) by Kevin MacLeod (incompetech.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `sounds/music-raw.mp3` | [Raw](https://commons.wikimedia.org/wiki/File:Raw_(ISRC_USUAN1100791).mp3) by Kevin MacLeod (incompetech.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `sounds/music-take-the-lead.mp3` | [Take the Lead](https://commons.wikimedia.org/wiki/File:Take_the_Lead_(ISRC_USUAN1100695).mp3) by Kevin MacLeod (incompetech.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

Music never starts before the player taps or presses a key. It follows the main Sound switch, has its own on/off and volume in Menu → Settings, fades out for the live show (the bell and crowd take over) and pauses when the app is in the background.

The bell is still made in code. The crowd is only heard for the main event, title changes and segments rated 80+, so it stays special. Each crowd line under a result ("Huge pop", "Loud boos for X", "Crickets") is chosen from what actually happened, and the clip that plays matches it. A flat segment plays nothing.
