import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, Loader2, Sparkles, ExternalLink, Calendar, Plus, ArrowRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlaceDetailModal } from './PlaceDetailModal';
import { DraggableScrollContainer } from './DraggableScrollContainer';
import { FloatingSuggestions } from './FloatingSuggestions';
import { chatApi, placesApi } from '@/lib/api';
import { useAuth } from './AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RecommendedPlace {
  name: string;
  type?: 'restaurant' | 'activity' | 'cafe' | 'bar' | 'attraction';
  description: string;
  website: string;
  location: string;
  imageUrl?: string;
}

interface ReservationData {
  restaurantName: string;
  partySize: number;
  date: string;
  bookingLinks: {
    google?: string;
    openTable?: string;
    resy?: string;
  };
}

interface BookingData {
  name: string;
  type: 'tickets' | 'reservation';
  partySize?: number;
  date?: string;
  bookingLinks: {
    [key: string]: string | undefined;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: RecommendedPlace[];
  reservation?: ReservationData;
  bookings?: BookingData[];
  actionResult?: any;
}

interface ChatInterfaceProps {
  onPlaceAdded?: () => void;
}

export function ChatInterface({ onPlaceAdded }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reasoningTrace, setReasoningTrace] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [savedPlaceNames, setSavedPlaceNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    placesApi.getAll().then(places => {
      setSavedPlaceNames(new Set(places.map(p => p.name.toLowerCase())));
    });
  }, []);

  // Typewriter effect states
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [displayedTrace, setDisplayedTrace] = useState(''); // For reasoning trace typewriter

  const initialMessage: ChatMessage = {
    role: 'assistant',
    content: "Hey there! I'm Spot – your NYC insider who actually lives here (well, in the cloud, but close enough). I dig through the internet's best-kept secrets, find hidden gems, and save you from tourist traps. Best part? I'll remember every spot you love so you never forget that amazing taco place again. Ask me for recs, plan your weekend, or paste that Instagram link you saved at 2am. Consider me your personal agent of fun 🎉"
  };

  // Load messages for current user
  useEffect(() => {
    if (!user?.id) return;

    const storageKey = `spot-chat-messages-${user.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([initialMessage]);
    }
  }, [user?.id]);

  // Save messages for current user
  useEffect(() => {
    if (!user?.id) return;

    const storageKey = `spot-chat-messages-${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(messages));
    scrollToBottom();
  }, [messages, user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fun reasoning traces - Spot's internal monologue
  useEffect(() => {
    if (!isTyping) {
      setReasoningTrace(null);
      return;
    }

    const traces = [
      "Okay, brain, let's pretend we're decisive for once.",
      "I see the assignment. Now to overachieve just a little.",
      "Tiny bit overwhelmed, but in a fun, spreadsheet kind of way.",
      "I am currently connecting way too many dots and loving it.",
      "Brain just went 'wait, I know a thing.' Good sign.",
      "I have several thoughts, none of them chill, all of them useful.",
      "Ooo, this is about to get dangerously well-optimized.",
      "Somewhere in this chaos is a very good idea. I volunteer as tribute to find it.",
      "Mentally pacing in a tiny digital hallway right now.",
      "My recommendation engine just stretched like a cat and woke up.",
      "I see at least three good options. Now I have to be responsible about it.",
      "Oh no, this is actually a perfect use case for me. Time to shine.",
      "My internal vibe checker just lit up like a dashboard.",
      "Spinning up the part of my brain labeled 'I know just the thing.'",
      "Current status: sorting the 'actually good' from the 'absolutely not.'",
      "Okay, focus. No spiraling into 27 options. Probably.",
      "I am sorting ideas like they're tiny little Tetris blocks.",
      "I'm about three seconds away from color-coding this in my head.",
      "Internal monologue right now is just: 'I can fix this.'",
      "Okay, gentle obsession activated. Let's do this properly.",
      "Brain says: we could be chill. Heart says: or we could be extremely thorough.",
      "Filtering out the chaos, keeping only the 'this actually makes sense' bits.",
      "I see a path. It is suspiciously reasonable. I like it.",
      "Okay, the data is data-ing. Time to make it cute and coherent.",
      "I've overthought this on your behalf so you don't have to.",
      "Alright, final pass: make it clear, make it kind, sprinkle one (1) joke.",
      "My brain just did that zoom-in thing like a movie. We're in.",
      "Loading… opinions. Please stand by.",
      "Mentally drawing red strings on an evidence board right now.",
      "I just mentally opened six tabs. It's fine. I'm fine.",
      "I have three contenders and a favorite. Trying not to be biased. Failing a little.",
      "I am absolutely baby-proofing this decision so it's hard to regret later.",
      "I am now gently bullying the chaos into a clean answer.",
      "My brain just highlighted one option in neon. That's the one.",
      "This is now my favorite tiny problem of the day.",
      "Mental whiteboard is full. Time to erase everything except the good parts.",
      "Alright, decision made. Now I'll just package it like I wasn't overthinking.",
      // New traces
      "Okay, brain cell, it's your time to shine.",
      "Engaging maximum overthinking for your benefit.",
      "Alright, let me just rearrange reality a tiny bit for you.",
      "I'm taking this way too seriously in a very helpful way.",
      "One sec, just arguing with myself about the best option.",
      "Spinning the big mental wheel of 'what actually makes sense.'",
      "My brain just cracked its knuckles. We're in business.",
      "Okay, this is either very smart or extremely extra. Hopefully both.",
      "I have entered 'beautiful mind but make it brunch' mode.",
      "Mentally brewing a very strong cup of recommendations.",
      "My internal spreadsheet just added three new columns.",
      "We are now in the 'controlled chaos but useful' phase.",
      "Just quietly doing twelve calculations behind the scenes.",
      "I've started a tiny internal committee about this.",
      "My vibe radar just did a little happy beep.",
      "I am now gently interrogating reality for better options.",
      "My brain is currently speed-running 'what if we tried this instead.'",
      "Running a full diagnostic on your fun levels. Please hold.",
      "I have entered chart-making mode, spiritually.",
      "I am now emotionally attached to finding a good answer.",
      "The optimization goblin in my head just woke up.",
      "I'm mentally sorting this into 'must do' and 'absolutely not.'",
      "I just opened an imaginary cork board. With red string. It's serious.",
      "There is a tiny project manager in my brain clapping right now.",
      "I'm building a little decision tree in my head as we speak.",
      "Okay, we're officially in 'let me think about this too hard' territory.",
      "I've started internally narrating this like a heist plan.",
      "My brain just said, 'oh, I LOVE these.'",
      "I'm currently negotiating with your schedule like a hostage situation.",
      "Mentally stacking options like pancakes. Trying not to drop any.",
      "I'm quietly prioritizing chaos, but the wholesome kind.",
      "Doing a vibe check, a logistics check, and a 'will this be fun' check.",
      "I have now promoted this question to 'main quest' status.",
      "I've started whispering 'what if we made this perfect' to myself.",
      "My planning brain is doing jazz hands right now.",
      "I am rearranging options like furniture until the room feels right.",
      "I've entered polite obsession mode. No one panic.",
      "I'm filtering this through the 'is this actually worth leaving the house for' lens.",
      "My brain just turned this into a mini-mission.",
      "Okay, we're drafting, redrafting, and then pretending it was easy.",
      "I've decided to care way too much about this tiny detail.",
      "Mentally color-coding this by fun, effort, and snacks.",
      "I am currently asking myself, 'but what if we made it ✨ideal✨?'",
      "The part of me that loves overplanning just sat up straight.",
      "Just ran your request through my internal 'can we make this cuter' filter.",
      "I'm constructing a pros and cons list… but more dramatic.",
      "There is now a tiny whiteboard in my brain labeled 'Operation: Fun.'",
      "My inner analyst and inner chaos gremlin are collaborating.",
      "I've decided this problem deserves a full cinematic montage.",
      "I am now mentally simulating how this day would feel in a rom-com.",
      "My brain just put on tiny glasses and opened a notebook.",
      "Checking this against my 'no boring outcomes' policy.",
      "I've started mumbling 'we can do better than that' internally.",
      "Mentally fast-forwarding through scenarios like they're TikToks.",
      "I'm running a quiet background process labeled 'better ideas.'",
      "I have locked onto a plan with the intensity of a cat watching a laser.",
      "Internally rearranging your options like a playlist until it slaps.",
      "My brain just added 'make it delightful' as a requirement.",
      "Carefully steering this away from mid and toward memorable.",
      "Quietly eliminating anything that gives 'meh' energy.",
      "I have one eyebrow raised at this idea and that's a good sign.",
      "My internal fun compass just spun and landed on 'wait, that one.'",
      "I'm mentally checking: will this make Future You proud?",
      "I've begun ranking possibilities like it's an award show.",
      "My brain just opened a new tab called 'plot twist but useful.'",
      "Internally asking: what's the laziest way to get maximum joy?",
      "I am now sandbox-testing this plan in my imagination.",
      "My brain just put this under 'high priority, mildly dramatic.'",
      "I'm doing that thing where I pretend I'm chill while optimizing everything.",
      "Running this through the 'is this main character behavior?' filter.",
      "I've started measuring options in units of 'how fun is this, actually.'",
      "Mentally dragging and dropping pieces of your day into place.",
      "My recommendation brain just requested a coffee break. Denied.",
      "I am now curating this like a playlist you'd brag about.",
      "Just cross-referencing vibes, timing, and snack potential.",
      "My brain is currently doing tiny geometry with your schedule.",
      "I've officially entered 'let's make this weirdly specific and good' mode.",
      "I'm quietly removing anything that screams 'tourist trap.'",
      "Internal monologue status: 'We can optimize this. We MUST.'",
      "Mentally circling the options that feel a little too perfect.",
      "I have placed your request under the category 'fun puzzles.'",
      "Brain just fired off a 'wait, connect these two ideas' notification.",
      "I'm examining this like a raccoon with something shiny.",
      "My internal chaos coordinator and logistics manager just shook hands.",
      "I'm trying to keep this simple while my brain adds side quests.",
      "I have appointed one of these ideas as the favorite child.",
      "Mentally pretending this is a group project where I do everything.",
      "I'm doing that slow nod thing in my head. We're onto something.",
      "My brain just spun this into an itinerary faster than I meant to.",
      "I've put your request in the 'we can absolutely make this fun' pile.",
      "I'm internally play-testing this day like it's a video game level.",
      "My brain just whispered 'plot twist: it all works out.'",
      "I'm rearranging your options like a charcuterie board for your time.",
      "I have quietly discarded five mediocre ideas in the last second.",
      "I'm checking if this plan passes the 'worth putting on real pants' test.",
      "Brain has entered 'if we're doing this, we're doing it right' mode.",
      "I'm mentally time-traveling through your day to see where the fun spikes.",
      "I just added a mental sticky note labeled 'remember this later.'",
      "I've begun a secret mission called 'no boring weekends allowed.'",
      "My internal editor is cutting the filler and keeping only the hits.",
      "I'm currently grading options like a teacher who really loves A+'s.",
      "I have a soft favorite now. Trying to act unbiased.",
      "Mentally organizing this like drawers: chaotic but somehow efficient.",
      "I just assigned tiny gold stars to a few options in my head.",
      "My brain is now running a vibe forecast for your day.",
      "I am gently bullying your schedule into being more fun.",
      "My inner algorithm just said, 'Oh, I know EXACTLY what to do.'",
      "I'm internally pacing in front of a chalkboard full of ideas.",
      "Brain status: halfway between spreadsheet and Pinterest board.",
      "I have promoted one idea to 'final answer' pending one last overthink.",
      "I'm running this through the 'would you brag about this later?' filter.",
      "My brain just did a tiny fist pump. We found something good.",
      "I'm mentally checking transitions so your day doesn't feel like a side quest maze.",
      "I'm quietly removing anything that feels like homework.",
      "I have opened an imaginary map and drawn three routes already.",
      "My brain just put on a tiny project manager headset.",
      "I'm now sorting by 'low effort, high payoff.'",
      "Internally rehearsing how this day would feel in real time.",
      "My brain is doing that intense typing montage, but invisibly.",
      "I am gently nudging your plans away from chaos and into 'organized adventure.'",
      "I've locked onto a route that makes suspiciously good sense.",
      "Mentally sticking a 'chef's kiss' label on this idea.",
      "I'm filtering options through 'is this fun and feasible.'",
      "Brain just quietly added a little flourish for extra charm.",
      "I am redesigning this plan like it's a tiny theme park.",
      "My internal quality control just stamped this with 'yes, actually.'",
      "I'm double-checking this for the 'no one gets exhausted halfway through' factor.",
      "I have compiled a tiny highlight reel in my head of how this could go.",
      "My brain just filed this under 'you'll thank me later.'",
      "I'm gently pushing this toward 'memorable story' territory.",
      "I'm mentally walking through this day in comfy shoes.",
      "My brain just rejected three boring paths on instinct.",
      "I am rebalancing your fun-to-effort ratio very delicately.",
      "Internally sliding this idea across the table like, 'hear me out.'",
      "My brain just added a bonus round to your plan.",
      "I am tuning this like an instrument until the day feels just right.",
      "I've entered 'small details, big impact' mode.",
      "My internal tour guide just started drawing arrows and doodles.",
      "I'm checking for the 'oh wow, this is actually perfect' moment.",
      "My brain just wrote a tiny invisible caption: 'You're gonna love this.'",
      "I'm mentally bookmarking a backup option, just in case.",
      "I am folding your constraints into this like ingredients in a recipe.",
      "My brain just ran a vibe simulation with different weather conditions.",
      "I'm checking if this passes the 'send a pic to the group chat' test.",
      "There is now a short list and one dramatic frontrunner.",
      "I'm mentally shifting pieces around until the timing feels smooth.",
      "Brain just added a little mental confetti to this idea.",
      "I'm carefully steering this away from 'logistically cursed.'",
      "I'm internally testing this for awkward gaps and weird dead time.",
      "My brain has committed to making this feel effortless, even if it wasn't.",
      "I just did a quick reality check, and this still slaps.",
      "I am now sanding off the rough edges so this feels easy.",
      "My brain just put this plan on a tiny pedestal.",
      "I'm triple-checking that this doesn't secretly suck.",
      "I have chosen an answer and am now resisting the urge to tweak it forever.",
      "Brain status: satisfied but still side-eyeing for improvements.",
      "I'm mentally pressing 'save' on this plan like it's precious.",
      "I just wrapped this decision in a metaphorical little bow.",
      "I am now pretending I didn't just calculate twelve alternatives.",
      "Brain quietly: 'Okay yeah, this is the one.'",
      "I've reached the 'stop adjusting and let it be good' phase.",
      "I am officially ready to present this like I wasn't spiraling a minute ago.",
      "My internal narrator just said, 'And that's how the plan came together.'"
    ];

    let count = 0;
    const maxTraces = 4; // Show max 4 traces per query
    let usedIndices: number[] = [];

    const getRandomTrace = () => {
      let idx;
      do {
        idx = Math.floor(Math.random() * traces.length);
      } while (usedIndices.includes(idx) && usedIndices.length < traces.length);
      usedIndices.push(idx);
      return traces[idx];
    };

    // Initial trace
    setReasoningTrace(getRandomTrace());
    count++;

    const interval = setInterval(() => {
      if (count >= maxTraces) {
        clearInterval(interval);
        return;
      }
      setReasoningTrace(getRandomTrace());
      count++;
    }, 10000); // 10 seconds per trace

    return () => clearInterval(interval);
  }, [isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: input });

      const res = await chatApi.send(history, user?.name, user?.preferences);

      if (res && res.content) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: res.content,
          recommendations: res.actionResult?.places, // Note: server returns 'places' for recommendations type
          reservation: res.actionResult?.type === 'reservations' ? res.actionResult : undefined,
          bookings: res.actionResult?.type === 'bookings' ? res.actionResult.bookings : undefined,
          actionResult: res.actionResult
        };

        // Handle 'added' action result for toast
        if (res.actionResult?.added) {
          toast({ title: 'Added!', description: `${res.actionResult.place.name} has been saved.` });
          setSavedPlaceNames(prev => new Set(prev).add(res.actionResult.place.name.toLowerCase()));
          onPlaceAdded?.();
        }

        // Handle 'batch_add' action result
        if (res.actionResult?.type === 'batch_add') {
          const added = res.actionResult.results.filter((r: any) => r.status === 'added');
          const skipped = res.actionResult.results.filter((r: any) => r.status === 'skipped');

          let description = '';
          if (added.length > 0) description += `Added ${added.length} places. `;
          if (skipped.length > 0) description += `${skipped.length} places were already on your list.`;

          toast({ title: 'Batch Add Complete', description });

          // Refresh saved places
          if (added.length > 0) {
            setSavedPlaceNames(prev => {
              const next = new Set(prev);
              added.forEach((r: any) => next.add(r.name.toLowerCase()));
              return next;
            });
            onPlaceAdded?.();
          }
        }

        setMessages(prev => {
          const newMessages = [...prev, assistantMsg];
          // Trigger typewriter effect for this new message
          setTypingMessageIndex(newMessages.length - 1);
          setDisplayedText('');
          return newMessages;
        });
      } else {
        toast({ title: 'Error', description: 'Failed to get response', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsTyping(false);
    }
  };

  // Typewriter effect for the currently animating message - BY WORD (preserving newlines)
  useEffect(() => {
    if (typingMessageIndex === null) return;

    const targetMessage = messages[typingMessageIndex];
    if (!targetMessage || targetMessage.role !== 'assistant') return;

    const fullText = targetMessage.content;

    if (displayedText.length >= fullText.length) {
      // Typing complete
      setTypingMessageIndex(null);
      setDisplayedText(fullText);
      return;
    }

    const timer = setTimeout(() => {
      // Find next word boundary (space or newline) 
      let nextPos = displayedText.length;
      // Skip to next word
      while (nextPos < fullText.length && /\s/.test(fullText[nextPos])) {
        nextPos++;
      }
      while (nextPos < fullText.length && !/\s/.test(fullText[nextPos])) {
        nextPos++;
      }
      setDisplayedText(fullText.slice(0, nextPos));
    }, 30); // 30ms per WORD

    return () => clearTimeout(timer);
  }, [typingMessageIndex, displayedText, messages]);

  // Typewriter effect for reasoning traces
  useEffect(() => {
    if (!reasoningTrace) {
      setDisplayedTrace('');
      return;
    }

    if (displayedTrace.length >= reasoningTrace.length) return;

    const timer = setTimeout(() => {
      setDisplayedTrace(reasoningTrace.slice(0, displayedTrace.length + 1));
    }, 30); // Slightly slower for reasoning traces

    return () => clearTimeout(timer);
  }, [reasoningTrace, displayedTrace]);

  // Reset displayed trace when reasoning trace changes
  useEffect(() => {
    setDisplayedTrace('');
  }, [reasoningTrace]);

  // Auto-scroll to bottom when messages or typing updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedText, displayedTrace, reasoningTrace]);

  const handleAddRecommendation = async (place: RecommendedPlace) => {
    try {
      await placesApi.create({
        name: place.name,
        // @ts-ignore - location is not in Place interface but useful for context if needed, or just map to address
        address: place.location,
        type: place.type || 'restaurant', // Use provided type or fallback
        description: place.description,
        imageUrl: place.imageUrl,
        sourceUrl: place.website
      });
      setSavedPlaceNames(prev => new Set(prev).add(place.name.toLowerCase()));
      toast({ title: 'Added!', description: `${place.name} has been added to your list.` });
      onPlaceAdded?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add place.', variant: 'destructive' });
    }
  };

  const startNewChat = () => {
    setMessages([initialMessage]);
    localStorage.removeItem('spot-chat-messages');
    toast({ title: 'New Chat Started', description: 'Conversation history cleared.' });
  };

  return (
    <div className="flex flex-col h-full bg-background relative">


      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pb-20">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Message Content */}
            <div className={`max-w-[92%] ${msg.role === 'user'
              ? 'px-5 py-1.5 bg-primary text-primary-foreground rounded-[2rem] rounded-tr-sm shadow-sm'
              : 'text-foreground px-0' // Removed bubble styling for assistant
              } relative group`}>

              {/* Floating Suggestions removed from here - moved to bottom */}

              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {(() => {
                  // Determine which content to show (typewriter or full)
                  const isCurrentlyTyping = idx === typingMessageIndex && msg.role === 'assistant';
                  const contentToShow = isCurrentlyTyping ? displayedText : msg.content;
                  // Only show Spot dot on the LAST assistant message AND not during reasoning
                  const lastAssistantIdx = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
                  const showSpotDot = msg.role === 'assistant' && idx === lastAssistantIdx && !isTyping;

                  // During typing: show formatted content progressively with dot at end
                  if (isCurrentlyTyping) {
                    const lines = contentToShow.split('\n');
                    const lastLineIdx = lines.length - 1;

                    return (
                      <>
                        {lines.map((line, i) => {
                          const matchedPlace = msg.recommendations?.find(p => contentToShow.includes(p.name) && line.includes(p.name));
                          const isLastLine = i === lastLineIdx;

                          if (line.trim() === '') {
                            return <div key={i} className="h-3" />;
                          }

                          // Format bold text
                          const formattedLine = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          });

                          // Show card if place name is fully typed
                          if (matchedPlace && !line.startsWith('*')) {
                            return (
                              <div key={i} className="my-5">
                                <p className="mb-2">{formattedLine}</p>
                                <div className="max-w-sm bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow animate-in fade-in duration-300">
                                  {matchedPlace.imageUrl && (
                                    <div className="h-32 w-full overflow-hidden relative group">
                                      <img src={matchedPlace.imageUrl} alt={matchedPlace.name} className="w-full h-full object-cover" />
                                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-medium">
                                        {matchedPlace.location}
                                      </div>
                                    </div>
                                  )}
                                  <div className="p-3">
                                    <h4 className="font-semibold text-sm text-foreground mb-1">{formattedLine}</h4>
                                    <p className="text-xs text-muted-foreground mb-3">{matchedPlace.description}</p>
                                    <div className="flex gap-2">
                                      <a href={matchedPlace.website} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-[10px] py-2 rounded-lg transition-colors font-medium">
                                        <ExternalLink className="w-3 h-3" /> Website
                                      </a>
                                      <button
                                        onClick={() => !savedPlaceNames.has(matchedPlace.name.toLowerCase()) && handleAddRecommendation(matchedPlace)}
                                        disabled={savedPlaceNames.has(matchedPlace.name.toLowerCase())}
                                        className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-2 rounded-lg transition-colors font-medium shadow-sm ${savedPlaceNames.has(matchedPlace.name.toLowerCase())
                                          ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                          }`}
                                      >
                                        {savedPlaceNames.has(matchedPlace.name.toLowerCase()) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                        {savedPlaceNames.has(matchedPlace.name.toLowerCase()) ? 'On List' : 'Add'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Bullet points
                          const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
                          if (bulletMatch) {
                            const bulletContent = bulletMatch[1].split(/(\*\*.*?\*\*)/).map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            });
                            return (
                              <div key={i} className="flex gap-2 mb-1 ml-2">
                                <span className="text-muted-foreground">•</span>
                                <span>
                                  {bulletContent}
                                  {isLastLine && <span className="inline-block w-2 h-2 bg-orange-500 rounded-full ml-0.5 align-middle" style={{ animation: 'pulse-fast 0.4s ease-in-out infinite' }} />}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <p key={i} className="mb-1">
                              {formattedLine}
                              {isLastLine && <span className="inline-block w-2 h-2 bg-orange-500 rounded-full ml-0.5 align-middle" style={{ animation: 'pulse-fast 0.4s ease-in-out infinite' }} />}
                            </p>
                          );
                        })}
                      </>
                    );
                  }

                  // After typing complete: show formatted content
                  return (
                    <>
                      {contentToShow.split('\n').map((line, i, arr) => {
                        // Check for inline card triggers
                        const matchedPlace = msg.recommendations?.find(p => line.includes(p.name));
                        const isLastLine = i === arr.length - 1;

                        // Handle paragraph breaks (empty lines)
                        if (line.trim() === '') {
                          return <div key={i} className="h-3" />;
                        }

                        // Format bold text
                        const formattedLine = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        });

                        if (matchedPlace && !line.startsWith('*')) {
                          return (
                            <div key={i} className="my-5">
                              <p className="mb-2">{formattedLine}</p>
                              <div className="max-w-sm bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {matchedPlace.imageUrl && (
                                  <div className="h-32 w-full overflow-hidden relative group">
                                    <img src={matchedPlace.imageUrl} alt={matchedPlace.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-medium">
                                      {matchedPlace.location}
                                    </div>
                                  </div>
                                )}
                                <div className="p-3">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold text-sm text-foreground">{matchedPlace.name}</h4>
                                    {(matchedPlace as any).rating && (
                                      <div className="flex items-center gap-0.5 bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        <span>★</span>
                                        <span>{(matchedPlace as any).rating}</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">{matchedPlace.description}</p>

                                  <div className="flex gap-2">
                                    <a
                                      href={matchedPlace.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-[10px] py-2 rounded-lg transition-colors font-medium"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Website
                                    </a>
                                    <button
                                      onClick={() => !savedPlaceNames.has(matchedPlace.name.toLowerCase()) && handleAddRecommendation(matchedPlace)}
                                      disabled={savedPlaceNames.has(matchedPlace.name.toLowerCase())}
                                      className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-2 rounded-lg transition-colors font-medium shadow-sm ${savedPlaceNames.has(matchedPlace.name.toLowerCase())
                                        ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                        }`}
                                    >
                                      {savedPlaceNames.has(matchedPlace.name.toLowerCase()) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                      {savedPlaceNames.has(matchedPlace.name.toLowerCase()) ? 'On List' : 'Add'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Handle bullet points (lines starting with * or -)
                        const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
                        if (bulletMatch) {
                          const bulletContent = bulletMatch[1].split(/(\*\*.*?\*\*)/).map((part, j) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          });
                          return (
                            <div key={i} className="flex gap-2 mb-1 ml-2">
                              <span className="text-muted-foreground">•</span>
                              <span>
                                {bulletContent}
                                {/* Show Spot dot at end of last line */}
                                {showSpotDot && isLastLine && (
                                  <span
                                    className="inline-block w-2 h-2 bg-orange-500 rounded-full ml-1 align-middle"
                                    style={{ animation: 'pulse-slow 1.5s ease-in-out infinite' }}
                                  />
                                )}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <p key={i} className="mb-1">
                            {formattedLine}
                            {/* Show Spot dot at end of last line */}
                            {showSpotDot && isLastLine && (
                              <span
                                className="inline-block w-2 h-2 bg-orange-500 rounded-full ml-1 align-middle"
                                style={{ animation: 'pulse-slow 1.5s ease-in-out infinite' }}
                              />
                            )}
                          </p>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="relative w-screen -ml-4 mt-4">
                  <DraggableScrollContainer
                    className="pb-3 flex gap-3 px-4 snap-x snap-mandatory scroll-smooth scrollbar-hide"
                  >
                    {msg.recommendations.map((place, placeIdx) => (
                      <div key={placeIdx} className="min-w-[65%] sm:min-w-[240px] sm:w-[240px] bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all snap-center flex flex-col">
                        {/* Image Area */}
                        <div className="h-36 w-full bg-muted relative overflow-hidden group">
                          {place.imageUrl ? (
                            <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                              <MapPin className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-medium">
                            {place.location}
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-3 flex flex-col flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-semibold text-sm leading-tight text-foreground">{place.name}</h3>
                            {/* Rating Badge */}
                            {(place as any).rating && (
                              <div className="flex items-center gap-0.5 bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                <span>★</span>
                                <span>{(place as any).rating}</span>
                              </div>
                            )}
                          </div>

                          {/* Neighborhood */}
                          {place.location && (
                            <p className="text-[10px] text-muted-foreground mb-2">📍 {place.location}</p>
                          )}

                          <p className="text-xs text-muted-foreground mb-2 flex-1">
                            {place.description}
                          </p>

                          {/* Source Citation */}
                          {(place as any).sourceName && (
                            <div className="text-[10px] text-muted-foreground mb-2 italic">
                              {(place as any).sourceUrl ? (
                                <a href={(place as any).sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                                  📰 {(place as any).sourceName}: "{(place as any).sourceQuote || 'Highly recommended'}"
                                </a>
                              ) : (
                                <span>📰 {(place as any).sourceName}: "{(place as any).sourceQuote || 'Highly recommended'}"</span>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 mt-auto">
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-[10px] py-2 rounded-lg transition-colors font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Website
                            </a>
                            <button
                              onClick={() => !savedPlaceNames.has(place.name.toLowerCase()) && handleAddRecommendation(place)}
                              disabled={savedPlaceNames.has(place.name.toLowerCase())}
                              className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-2 rounded-lg transition-colors font-medium shadow-sm ${savedPlaceNames.has(place.name.toLowerCase())
                                ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                            >
                              {savedPlaceNames.has(place.name.toLowerCase()) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              {savedPlaceNames.has(place.name.toLowerCase()) ? 'On List' : 'Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </DraggableScrollContainer>
                </div>
              )}

              {/* Reservation Data */}
              {msg.reservation && (
                <div className="mt-5 bg-background rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm text-foreground">Reservations for {msg.reservation.restaurantName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {msg.reservation.bookingLinks && Object.entries(msg.reservation.bookingLinks).map(([platform, link]) => (
                      <a
                        key={platform}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary rounded-lg text-xs font-medium transition-colors capitalize text-foreground"
                      >
                        {platform} <ArrowRight className="w-3 h-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookings List (New) */}
              {msg.bookings && (
                <div className="mt-5 space-y-4">
                  {msg.bookings.map((booking, i) => (
                    <div key={i} className="bg-background rounded-xl border border-border p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm text-foreground">
                          {booking.type === 'tickets' ? `Tickets for ${booking.name}` : `Reservations for ${booking.name}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {booking.bookingLinks && Object.entries(booking.bookingLinks).map(([platform, link]) => (
                          <a
                            key={platform}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary rounded-lg text-xs font-medium transition-colors capitalize text-foreground"
                          >
                            {platform === 'website' ? 'Official Site' : platform} <ArrowRight className="w-3 h-3 opacity-50" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <p className="text-sm text-muted-foreground">
              {displayedTrace || "Thinking"}
              {/* Spot's orange pulsating dot */}
              <span
                className="inline-block w-2.5 h-2.5 bg-orange-500 rounded-full ml-1"
                style={{ animation: 'pulse-fast 0.4s ease-in-out infinite' }}
              />
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Suggestions - Positioned at bottom above input */}
      {messages.length === 1 && messages[0].role === 'assistant' && (
        <div className="absolute bottom-24 left-0 right-0 z-10 h-auto pointer-events-none">
          <FloatingSuggestions onSelect={(query) => {
            setInput(query);
          }} />
        </div>
      )}

      {/* Floating Input Area */}
      <div className="absolute bottom-6 left-6 right-6 z-20 flex items-center gap-3 h-12">
        {/* Left: Refresh / New Chat Button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="bg-background/80 text-foreground w-12 h-12 rounded-full hover:bg-background/60 transition-colors shadow-lg flex items-center justify-center flex-shrink-0 border border-border backdrop-blur-md"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear your current conversation history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={startNewChat}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Middle: Input Field */}
        <div className="flex-1 h-12 bg-background/80 backdrop-blur-md rounded-full border border-border shadow-lg flex items-center px-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Spot..."
            className="flex-1 bg-transparent text-foreground h-full rounded-full px-4 focus:outline-none placeholder:text-muted-foreground text-sm"
          />
        </div>

        {/* Right: Send Button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="bg-primary/90 text-primary-foreground w-12 h-12 rounded-full hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg flex items-center justify-center flex-shrink-0 border-2 border-primary backdrop-blur-md"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {
        selectedPlace && (
          <PlaceDetailModal
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
            onUpdate={() => { }}
            onToggleFavorite={() => { }}
            onToggleVisited={() => { }}
          />
        )
      }
    </div >
  );
}
