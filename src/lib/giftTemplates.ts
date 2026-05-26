export interface GiftTemplate {
  id: string;
  occasion: string;
  emoji: string;
  suggestedMessage: string;
}

export const GIFT_TEMPLATES: GiftTemplate[] = [
  {
    id: "birthday",
    occasion: "Birthday",
    emoji: "🎂",
    suggestedMessage:
      "Wishing you a wonderful birthday! This gift is locked until your special day — enjoy the surprise! 🎉",
  },
  {
    id: "valentine",
    occasion: "Valentine's Day",
    emoji: "❤️",
    suggestedMessage:
      "Happy Valentine's Day! A little something to show how much you mean to me. Unlock it and feel the love 💕",
  },
  {
    id: "graduation",
    occasion: "Graduation",
    emoji: "🎓",
    suggestedMessage:
      "Congratulations on your graduation! You worked so hard for this — here's a gift to celebrate your achievement 🌟",
  },
  {
    id: "anniversary",
    occasion: "Anniversary",
    emoji: "💍",
    suggestedMessage:
      "Happy Anniversary! Every year with you is a blessing. This gift unlocks on our special day 🥂",
  },
  {
    id: "eid",
    occasion: "Eid",
    emoji: "🌙",
    suggestedMessage:
      "Eid Mubarak! May this blessed occasion bring you joy and prosperity. A little gift from the heart 🤲",
  },
];

export const BLANK_TEMPLATE: GiftTemplate = {
  id: "blank",
  occasion: "Custom",
  emoji: "🎁",
  suggestedMessage: "",
};
