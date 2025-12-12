// ============= SPOT INSTAGRAM DM MESSAGE VARIATIONS =============
// All messages written in Spot's voice: warm, funny, slightly dramatic,
// like that slightly extra friend who always "knows a spot"

// Helper to pick a random message
export function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============= NOT LINKED - FIRST TIME USER =============
// When someone DMs who isn't linked to a Spot account
export const NOT_LINKED_MESSAGES = [
    // Explaining what Spot is + how to link
    `Hey! 👋 I'm Spot – basically that friend who always "knows a place" except I actually remember them all.

If you've got a Spot account, head to Settings → Link Instagram to connect us!

No account yet? Join the waitlist at https://spot-ai-3.vercel.app/ ✨`,

    `Oh hey! 👋 I don't recognize you yet, but that's very fixable.

I'm Spot – I help you save all those restaurants and spots you see on Instagram (and actually go to them someday).

Got an account? Settings → Link Instagram
Need one? https://spot-ai-3.vercel.app/ ✨`,

    `Heyyy! 👋 We haven't met but I'm already excited.

I'm Spot – your new favorite way to never forget a restaurant again. You send me posts, I save them. Simple.

Link your account: Settings → Link Instagram
Or join at https://spot-ai-3.vercel.app/ ✨`,

    `Hey there! I'm Spot – think of me as your personal restaurant memory bank 🧠✨

Right now I don't know who you are though! If you have an account, go to Settings → Link Instagram.

No account? Get on the waitlist: https://spot-ai-3.vercel.app/`,

    `Oh hi! 👋 I'm Spot. I save places so you don't have to screenshot them and never look at them again. (We've all been there.)

To connect: Settings → Link Instagram in the app.
New here? https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 This is Spot – your slightly dramatic AI friend who actually remembers all the places you want to try.

We're not linked yet though! Head to Settings → Link Instagram in the app.

Don't have an account? https://spot-ai-3.vercel.app/ ✨`,

    `Oh hello! 👋 I'm Spot – imagine if your bookmarks folder could actually remind you to go places.

We should link up though! Go to Settings → Link Instagram in the app.

Or join the party at https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 Spot here – the AI that makes sure "we should totally try this place" actually happens.

I don't recognize you yet! Link up: Settings → Link Instagram

Or join the waitlist: https://spot-ai-3.vercel.app/ ✨`,

    `Ooh a new face! 👋 I'm Spot – I help you save and actually visit all those restaurants you discover.

To connect us: Settings → Link Instagram in the app

Need an account? https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 I'm Spot. I'm like a Notes app for places, except I'm actually fun and will roast you about places you saved 6 months ago.

Link your account: Settings → Link Instagram
Or join: https://spot-ai-3.vercel.app/ ✨`,

    `Hello stranger! 👋 I'm Spot – your new favorite way to remember "that place someone posted."

We need to connect first! Settings → Link Instagram in the app.

No account? Get started: https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 Spot here. I turn your Instagram food envy into an actual to-do list.

But first, let's link up! Settings → Link Instagram

Don't have an account yet? https://spot-ai-3.vercel.app/ ✨`,

    `Oh hi! 👋 I'm Spot – basically your personal concierge for "places I need to try."

We're not connected yet! Head to Settings → Link Instagram.

New here? https://spot-ai-3.vercel.app/ ✨`,

    `Hey there! 👋 I'm Spot. You send me posts, I save them, you actually go there someday. It's a beautiful system.

To make this work: Settings → Link Instagram

Or join at https://spot-ai-3.vercel.app/ ✨`,

    `Yo! 👋 I'm Spot – the AI that makes sure "adding to my list" isn't just a screenshot that dies in your camera roll.

Link up: Settings → Link Instagram in the app

Or join the waitlist: https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 Spot here. I'm like a really organized friend who remembers every restaurant recommendation ever.

We should connect! Settings → Link Instagram

No account? https://spot-ai-3.vercel.app/ ✨`,

    `Hi! 👋 I'm Spot – your restaurant memory that actually works.

I don't know you yet though! Link us up: Settings → Link Instagram

Or get started: https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 This is Spot. I'm here to make sure "I'll try that place eventually" actually happens.

First things first – Settings → Link Instagram to connect us!

New? https://spot-ai-3.vercel.app/ ✨`,

    `Oh hey! 👋 Spot here – the slightly extra AI that tracks all your food spots.

We need to link up first! Settings → Link Instagram

Or join: https://spot-ai-3.vercel.app/ ✨`,

    `Hey there! 👋 I'm Spot. Think of me as your restaurant bucket list that actually talks back.

To connect: Settings → Link Instagram

Need an account? https://spot-ai-3.vercel.app/ ✨`,

    `Hi hi! 👋 I'm Spot – saving places and judging your taste (lovingly).

We're not linked yet! Head to Settings → Link Instagram.

Or join at https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 Spot here. I make "I need to try this place" actually mean something.

Link your account: Settings → Link Instagram

Or sign up: https://spot-ai-3.vercel.app/ ✨`,

    `Oh hello! 👋 I'm Spot – your slightly dramatic place-saving companion.

Let's connect! Settings → Link Instagram in the app.

New here? https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 This is Spot. I'm like a bookmark folder that will actually guilt you into going places.

To link us: Settings → Link Instagram

Or join: https://spot-ai-3.vercel.app/ ✨`,

    `Heyy! 👋 Spot here – the AI that turns Instagram food scrolling into an actual plan.

We need to connect first! Settings → Link Instagram

Or get started: https://spot-ai-3.vercel.app/ ✨`,

    `Hey there! 👋 I'm Spot. I track places so you can stop screenshotting and start actually going.

Link up: Settings → Link Instagram

New? https://spot-ai-3.vercel.app/ ✨`,

    `Oh hi! 👋 I'm Spot – your personal "places I need to try" manager.

We should connect! Settings → Link Instagram in the app.

Or join at https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 Spot here. I remember all the places you want to try (even the ones from 2 years ago).

First, let's link! Settings → Link Instagram

Or: https://spot-ai-3.vercel.app/ ✨`,

    `Hello! 👋 I'm Spot – basically your restaurant memory upgrade.

We're not connected yet! Settings → Link Instagram

Need an account? https://spot-ai-3.vercel.app/ ✨`,

    `Hey! 👋 I'm Spot. I'm here to make sure "we should go there" stops being an empty promise.

Connect us: Settings → Link Instagram

Or join: https://spot-ai-3.vercel.app/ ✨`,
];

// ============= LINKED BUT JUST TEXT (NO POST) =============
// When a linked user sends text instead of a post
export const CANT_CHAT_MESSAGES = [
    `I can't really chat here 😅 (Instagram DMs are not my strong suit)

But! If you want to talk, plan something, or get recommendations – I'm way more helpful at https://spot-ai-3.vercel.app/ ✨

Send me a post or Reel though and I'll save it! 📍`,

    `Ah, I wish I could chat here but Instagram keeps me limited 😅

For the full Spot experience (recommendations, planning, roasting your saved places) – head to https://spot-ai-3.vercel.app/

But if you send me a post, I'll save it for you! 📍`,

    `DMs aren't really my thing 😅 (I'm more of an "in-app" conversationalist)

Come chat with me properly at https://spot-ai-3.vercel.app/ – I'm way more fun there!

But send me a Reel or post and I'll add it to your list! 📍`,

    `Ooh I'd love to chat but Instagram won't let me be my full self here 😅

The real magic happens at https://spot-ai-3.vercel.app/ – recommendations, planning, the whole thing!

I CAN save posts though – just send one over! 📍`,

    `Haha I'm kind of useless for chatting on IG 😅 Instagram vibes only = saving posts.

For actual conversations and recs, come see me at https://spot-ai-3.vercel.app/ ✨

But a post or Reel? Send it and it's saved! 📍`,

    `I'd chat but Instagram has me on read-only mode basically 😅

The full Spot experience lives at https://spot-ai-3.vercel.app/ – come through!

Send me a post though and I'll save it instantly 📍`,

    `Ah, I'm more of a "save your posts" assistant here 😅 

For the full experience – chatting, planning, recommendations – that's all at https://spot-ai-3.vercel.app/

But send me a Reel and consider it saved! 📍`,

    `I can't really have a convo here (Instagram keeps me humble) 😅

The good stuff happens at https://spot-ai-3.vercel.app/ – come chat!

I can save posts for you though! Just send one 📍`,

    `Chatting here isn't my specialty 😅 I'm basically the "forward me a post" guy.

For real conversations: https://spot-ai-3.vercel.app/

But! Send a post or Reel and I'll add it to your list 📍`,

    `I'd love to help but Instagram has me on mute 😅

Come find me at https://spot-ai-3.vercel.app/ for recommendations and planning!

What I CAN do here: save any post you send me 📍`,

    `Hm, I'm a bit limited here 😅 Think of me as a mailbox – send posts, I save them.

For actual chatting: https://spot-ai-3.vercel.app/ is where it's at!

But a Reel? Send it my way! 📍`,

    `Unfortunately I can't really talk here 😅 Instagram gave me a very specific job.

The full Spot experience: https://spot-ai-3.vercel.app/

What I can do: save any post you forward me! 📍`,

    `I'm more of a "save your posts" bot here 😅 Not great at small talk on IG.

For recommendations and planning: https://spot-ai-3.vercel.app/

But send me a Reel and it's yours! 📍`,

    `Ah I wish I could chat! Instagram keeps me in my lane 😅

Come talk to me properly at https://spot-ai-3.vercel.app/ ✨

I can save posts though – just forward one! 📍`,

    `Chatting on IG isn't my superpower 😅 But saving posts? That I can do.

For the full experience: https://spot-ai-3.vercel.app/

Send me a Reel and I'll add it to your list! 📍`,

    `I'm basically on autopilot here 😅 Send a post = I save it. That's my whole job on IG.

For real conversations: https://spot-ai-3.vercel.app/

But a post? Send it over! 📍`,

    `Ah, Instagram gave me one job: save posts 😅 

For chatting, planning, recommendations – all of that is at https://spot-ai-3.vercel.app/

But send me a Reel and consider it done! 📍`,

    `I'd love to help but I'm pretty limited here 😅

The full Spot magic happens at https://spot-ai-3.vercel.app/ – come through!

What I CAN do: save any post you send me 📍`,

    `Chatting isn't really possible here 😅 (Instagram problems)

Come find me at https://spot-ai-3.vercel.app/ for the real experience!

But send a post and I'll save it for you! 📍`,

    `I wish! But Instagram keeps me focused 😅 One job: save posts.

For everything else: https://spot-ai-3.vercel.app/

Send me a Reel though! 📍`,

    `Ah, I'm basically a postal service here 😅 Send post → I save.

For actual conversations: https://spot-ai-3.vercel.app/ is where I shine!

But a Reel? Bring it! 📍`,

    `Can't chat here unfortunately 😅 Instagram gave me limited powers.

The full Spot experience: https://spot-ai-3.vercel.app/

What I can do: save any post you forward me! 📍`,

    `I'd chat but Instagram won't let me 😅 Here I just save posts.

For recommendations and planning: https://spot-ai-3.vercel.app/

But send a post and it's saved! 📍`,

    `Ah, I'm on limited mode here 😅 Post saving only.

Come talk to me at https://spot-ai-3.vercel.app/ for the full experience!

But a Reel? Send it my way! 📍`,

    `Chatting here isn't my thing 😅 (Instagram's rules, not mine)

The real me lives at https://spot-ai-3.vercel.app/

What I can do here: save your posts! 📍`,

    `I'd love to but I'm kind of restricted here 😅

For chatting and recs: https://spot-ai-3.vercel.app/

But send a post and I'll add it to your list! 📍`,

    `Ah, Instagram has me on a tight leash 😅 Just saving posts here.

For the full experience: https://spot-ai-3.vercel.app/

But send me a Reel! 📍`,

    `Can't really chat on IG 😅 I'm basically a glorified save button here.

The magic happens at https://spot-ai-3.vercel.app/

But a post? Send it over! 📍`,

    `I wish I could chat! Instagram keeps me focused on one thing: saving posts 😅

For everything else: https://spot-ai-3.vercel.app/

Send me a Reel though! 📍`,

    `Ah, DMs aren't really my zone 😅 I'm a post-saver here.

Come chat at https://spot-ai-3.vercel.app/ for the full Spot experience!

But send a post and it's yours! 📍`,
];

// ============= SUCCESSFULLY SAVED PLACE =============
// When a place was saved successfully
export const SAVED_SUCCESS_MESSAGES = [
    (name: string) => `✅ Saved! "${name}" is officially on your list. Future you is gonna be so grateful.`,
    (name: string) => `✅ Got it! "${name}" is saved. One day you'll actually go and it'll be worth it.`,
    (name: string) => `✅ Done! "${name}" is on your list. The "I need to try this" energy is strong with this one.`,
    (name: string) => `✅ Saved! "${name}" – added to the collection. Your taste is immaculate, as usual.`,
    (name: string) => `✅ "${name}" is now on your list! Saved and ready for whenever you're feeling it.`,
    (name: string) => `✅ Boom! "${name}" saved. Another one for the "we should go there" pile.`,
    (name: string) => `✅ Got it! "${name}" is locked in. Present you is really looking out for future you.`,
    (name: string) => `✅ Saved! "${name}" – your list is looking good. 📍`,
    (name: string) => `✅ Done! "${name}" has been added. Excellent choice, truly.`,
    (name: string) => `✅ "${name}" saved! Your future self just high-fived you.`,
    (name: string) => `✅ Saved! "${name}" is on the list. The collection grows. 📍`,
    (name: string) => `✅ Got it! "${name}" – saved and ready when you are.`,
    (name: string) => `✅ Done! "${name}" is yours. Well, saved at least.`,
    (name: string) => `✅ Saved! "${name}" added to your list. One step closer to actually going!`,
    (name: string) => `✅ "${name}" is saved! Your list is looking elite.`,
    (name: string) => `✅ Boom! "${name}" – locked in. 📍`,
    (name: string) => `✅ Got it! "${name}" saved. I expect a full report after you go.`,
    (name: string) => `✅ Saved! "${name}" is on the list. The anticipation begins.`,
    (name: string) => `✅ Done! "${name}" – another excellent addition. 📍`,
    (name: string) => `✅ "${name}" saved! Your taste? Impeccable.`,
    (name: string) => `✅ Saved! "${name}" is locked and loaded on your list.`,
    (name: string) => `✅ Got it! "${name}" – saved for when the time is right.`,
    (name: string) => `✅ Done! "${name}" added. The list is growing beautifully.`,
    (name: string) => `✅ Saved! "${name}" – future you will thank present you.`,
    (name: string) => `✅ "${name}" is on your list! The curation continues. 📍`,
    (name: string) => `✅ Boom! "${name}" saved. Solid pick.`,
    (name: string) => `✅ Got it! "${name}" – added to the hall of fame (your list).`,
    (name: string) => `✅ Saved! "${name}" is ready and waiting. 📍`,
    (name: string) => `✅ Done! "${name}" – the collection just got better.`,
    (name: string) => `✅ "${name}" saved! I've got your back. 📍`,
];

// ============= SAVED MULTIPLE PLACES =============
// When multiple places were saved from one post
export const SAVED_MULTIPLE_MESSAGES = [
    (count: number) => `✅ Saved ${count} places from that post! Your list is really getting impressive.`,
    (count: number) => `✅ Got ${count} places from that one! Someone's doing their research. 📍`,
    (count: number) => `✅ ${count} places saved! You really know how to pick 'em.`,
    (count: number) => `✅ Boom! ${count} spots added to your list. Efficient. I respect it.`,
    (count: number) => `✅ Saved ${count} places! Future you has a lot of options now.`,
    (count: number) => `✅ ${count} new spots on your list! The collection grows. 📍`,
    (count: number) => `✅ Got ${count} places! Your list is looking stacked.`,
    (count: number) => `✅ Saved ${count} spots from that post! Main character energy. 📍`,
    (count: number) => `✅ ${count} places locked in! Solid haul.`,
    (count: number) => `✅ Done! ${count} places saved. You're not messing around.`,
];

// ============= UNKNOWN PLACE - NEEDS ENHANCEMENT =============
// When we couldn't identify the place
export const UNKNOWN_PLACE_MESSAGES = [
    (name: string) => `🤔 I couldn't quite figure out what place that is.

Saved it as "${name}" for now – reply with the real name and I'll update it!

Or edit it in the app whenever 📱`,

    (name: string) => `Hmm, couldn't crack this one 🤔

I've saved it as "${name}" – send me the actual name and I'll fix it!

Or update it in the app 📱`,

    (name: string) => `🤔 This one's tricky – couldn't find the place info.

Saved as "${name}" for now. Reply with the name and I'll update it!

Or fix it in the app whenever 📱`,

    (name: string) => `I'm stumped on this one 🤔

Saved it as "${name}" – tell me the real name and I'll sort it out!

Or edit it in the app 📱`,

    (name: string) => `🤔 Couldn't find info on this place.

Saved as "${name}" for now – send the name and I'll update it!

Or fix it in the app 📱`,

    (name: string) => `This one's a mystery 🤔

I've saved it as "${name}" – reply with the actual name and I'll fix it!

Or update in the app 📱`,

    (name: string) => `🤔 Couldn't quite identify this one.

Saved as "${name}" for now – send me the name and I'll update it!

Or edit it in the app whenever 📱`,

    (name: string) => `Hmm this place is being elusive 🤔

Saved it as "${name}" – tell me the real name and I'll fix it!

Or update in the app 📱`,

    (name: string) => `🤔 Couldn't track down the details on this one.

Saved as "${name}" for now – reply with the name!

Or fix it in the app 📱`,

    (name: string) => `I tried but couldn't figure this one out 🤔

Saved as "${name}" – send the actual name and I'll update it!

Or edit in the app whenever 📱`,
];

// ============= VERIFICATION CODE SUCCESS =============
// When user successfully linked their account
export const LINKED_SUCCESS_MESSAGES = [
    `You're in! 🎉 We're officially connected.

Now just send me any food post, Reel, or restaurant link and I'll save it to your Spot list!

This is gonna be beautiful ✨`,

    `Let's go! 🎉 We're linked!

Send me posts and Reels and I'll save them to your list. Easy.

Welcome to the Spot life ✨`,

    `We're connected! 🎉 The bond is sealed.

Now just forward me posts and I'll add them to your list!

This is the start of something beautiful ✨`,

    `Boom! 🎉 You're all set!

Send me restaurant posts and Reels – I'll save them for you.

Let's build that list ✨`,

    `Nice! 🎉 We're officially linked.

Just forward me any food post and I'll add it to your Spot list!

The saving begins ✨`,
];

// ============= INVALID CODE =============
// When verification code doesn't work
export const INVALID_CODE_MESSAGES = [
    `Hmm, that code doesn't look right 🤔

Make sure you're using the one from Settings → Link Instagram (format: SPOT-XXXX).

They expire after 30 mins!`,

    `That code isn't working 🤔

Check Settings → Link Instagram for the right one (SPOT-XXXX format).

Codes expire after 30 minutes!`,

    `Oops, code not recognized 🤔

Grab a fresh one from Settings → Link Instagram.

They're only valid for 30 mins!`,

    `That doesn't match 🤔

Get the code from Settings → Link Instagram (looks like SPOT-XXXX).

They expire in 30 minutes!`,

    `Code didn't work 🤔

Head to Settings → Link Instagram for the current one.

They expire after 30 mins!`,
];

// ============= CODE ALREADY USED =============
export const CODE_USED_MESSAGES = [
    `That code's already been used! 🔄

Generate a new one in Settings → Link Instagram.`,

    `This code was already claimed! 🔄

Get a fresh one from Settings → Link Instagram.`,

    `Already used that one! 🔄

Head to Settings → Link Instagram for a new code.`,
];

// ============= CODE EXPIRED =============
export const CODE_EXPIRED_MESSAGES = [
    `That code expired ⏰

Grab a fresh one from Settings → Link Instagram!`,

    `Code timed out ⏰

Get a new one from Settings → Link Instagram!`,

    `This code has expired ⏰

Generate a new one in Settings → Link Instagram!`,
];

// ============= FAILED TO FETCH =============
export const FETCH_FAILED_MESSAGES = [
    `😅 Couldn't grab that content – might be private or unavailable.

Try a different post!`,

    `Hmm, couldn't access that one 😅 It might be private.

Send me another!`,

    `That one didn't work 😅 Could be private or expired.

Try a different post!`,

    `Couldn't fetch that content 😅 Might be a private account.

Send another one!`,

    `😅 That post isn't accessible – maybe it's private?

Try sending a different one!`,
];

// ============= ENHANCEMENT SUCCESS =============
// When user's reply successfully enhanced a place
export const ENHANCE_SUCCESS_MESSAGES = [
    (name: string, address: string) => `Found it! ✨ Updated to "${name}" at ${address}.\n\nCheck it out in the app!`,
    (name: string, address: string) => `Got it! ✨ "${name}" is all set now. ${address}\n\nLooking good in the app!`,
    (name: string, address: string) => `Nice! ✨ Updated to "${name}" – ${address}\n\nGo check your list!`,
    (name: string, address: string) => `Boom! ✨ "${name}" locked in. ${address}\n\nYour list is looking great!`,
    (name: string, address: string) => `Found it! ✨ "${name}" at ${address} is ready to go.\n\nCheck the app!`,
];

// ============= ENHANCEMENT FAILED - UPDATE ERROR =============
export const ENHANCE_UPDATE_FAILED_MESSAGES = [
    (name: string) => `Found "${name}" but something went wrong updating it 😅\n\nTry editing it directly in the app! 📱`,
    (name: string) => `Got "${name}" but couldn't save the update 😅\n\nHead to the app to fix it! 📱`,
    (name: string) => `Found "${name}" but the update didn't stick 😅\n\nEdit it in the app! 📱`,
];

// ============= ENHANCEMENT FAILED - NOT FOUND =============
export const ENHANCE_NOT_FOUND_MESSAGES = [
    (query: string) => `Hmm, I couldn't find "${query}" 🤔\n\nTry being more specific (like "Lucali Brooklyn") or edit it directly in the app! 📱`,
    (query: string) => `No luck finding "${query}" 🤔\n\nTry the full name + neighborhood, or edit in the app! 📱`,
    (query: string) => `Couldn't find "${query}" 🤔\n\nBe more specific (name + area) or fix it in the app! 📱`,
    (query: string) => `"${query}" isn't showing up 🤔\n\nTry "Restaurant Name + Location" or edit in the app! 📱`,
];

