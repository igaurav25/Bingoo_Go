/**
 * public/js/i18n.js
 * 
 * Bilingual Localization (English & Hindi) for Bingo.
 * Everyday, natural Hindi wording (not literal robot translations).
 * "BINGO" brand stays unchanged in both languages.
 */

export const STRINGS = {
  en: {
    appTitle: 'Bingo',
    tagline: 'Classic notebook bingo with friends',
    createRoom: 'Create room',
    joinWithCode: 'Join with code',
    joinButton: 'Join',
    enterCodePlaceholder: '5-CHAR CODE',
    howToPlay: 'How to play',
    settings: 'Settings',
    stats: 'My stats',

    // Lobby
    roomCode: 'Room code',
    tapToCopy: 'Tap to copy code',
    linkCopied: 'Room link copied to clipboard!',
    codeCopied: 'Room code copied to clipboard!',
    share: 'Share',
    qrCode: 'QR Code',
    waitingForFriend: 'Waiting for friend to join...',
    host: 'Host',
    guest: 'Guest',
    ready: 'Ready',
    notReady: 'Not ready',
    toggleReady: 'Ready to play',
    waitingReady: 'Waiting for ready...',
    turnTimer: 'Turn timer',
    timerOff: 'Off',
    practiceBot: 'Practice vs Bot',

    // Arrange
    arrangeTitle: 'Arrange your card',
    arrangeDesc: 'Tap one cell, then another, to swap numbers.',
    autoArrange: 'Auto arrange',
    reset: 'Reset (1-25)',
    lockBoard: 'Lock board',
    friendReady: 'Friend is ready',
    friendArranging: 'Friend is arranging...',
    boardLocked: 'Board locked! Waiting for friend...',

    // Game
    yourTurn: 'Your turn — call a number',
    friendTurn: "{name}'s turn — waiting for call",
    turnTimeRemaining: 's remaining',
    recentCalls: 'Recent calls:',
    claimBingo: 'CLAIM BINGO!',
    linesCompletedCount: '{count}/5 lines',
    friendDisconnected: 'Friend disconnected. Waiting up to {seconds} s.',
    openedInAnotherTab: 'Opened in another tab. This session is now inactive.',

    // Result
    victory: 'VICTORY!',
    defeat: 'DEFEAT',
    youWon: 'You completed 5 lines and claimed BINGO!',
    friendWon: '{name} completed 5 lines and claimed BINGO!',
    forfeitVictory: 'Opponent disconnected. Victory by forfeit!',
    rematch: 'Rematch',
    rematchRequested: 'Rematch requested...',
    leave: 'Leave room',
    shareCard: 'Share result',

    // Settings
    language: 'Language',
    background: 'Background',
    themeIndigo: 'Night Indigo',
    themeOcean: 'Ocean Blue',
    themePlum: 'Plum Violet',
    themeForest: 'Forest Green',
    sound: 'Sound effects',
    vibration: 'Vibration',
    reduceMotion: 'Reduce motion',
    close: 'Close',

    // How to Play
    rule1Title: '1. Arrange',
    rule1Desc: 'Swap numbers 1-25 on your notebook paper card or tap Auto Arrange.',
    rule2Title: '2. Cut Lines',
    rule2Desc: 'Take turns calling numbers. Completing any row or column draws a red pen stroke and strikes B-I-N-G-O.',
    rule3Title: '3. Claim BINGO',
    rule3Desc: 'When all 5 letters are struck, the golden BINGO button unlocks. Tap it first to win!'
  },
  hi: {
    appTitle: 'BINGO',
    tagline: 'दोस्तों के साथ असली नोटबुक बिंगो',
    createRoom: 'कमरा बनाएँ',
    joinWithCode: 'कोड से जुड़ें',
    joinButton: 'जुड़ें',
    enterCodePlaceholder: '5-अक्षर कोड',
    howToPlay: 'कैसे खेलें',
    settings: 'सेटिंग्स',
    stats: 'मेरे आँकड़े',

    // Lobby
    roomCode: 'कमरा कोड',
    tapToCopy: 'कोड कॉपी करने के लिए टैप करें',
    linkCopied: 'लिंक कॉपी हो गया!',
    codeCopied: 'कोड कॉपी हो गया!',
    share: 'शेयर करें',
    qrCode: 'क्यूआर कोड',
    waitingForFriend: 'दोस्त के जुड़ने का इंतज़ार...',
    host: 'होस्ट',
    guest: 'दोस्त',
    ready: 'तैयार',
    notReady: 'रुके हैं',
    toggleReady: 'खेलने के लिए तैयार',
    waitingReady: 'तैयार होने की प्रतीक्षा...',
    turnTimer: 'टर्न टाइमर',
    timerOff: 'बंद',
    practiceBot: 'बॉट के साथ अभ्यास',

    // Arrange
    arrangeTitle: 'नंबर सेट करें',
    arrangeDesc: 'एक डिब्बे पर टैप करें, फिर दूसरे पर बदलें।',
    autoArrange: 'ऑटो सेट करें',
    reset: 'रीसेट (1-25)',
    lockBoard: 'कार्ड लॉक करें',
    friendReady: 'दोस्त तैयार है',
    friendArranging: 'दोस्त कार्ड सेट कर रहा है...',
    boardLocked: 'कार्ड लॉक हो गया! दोस्त की प्रतीक्षा...',

    // Game
    yourTurn: 'आपकी बारी — एक नंबर बोलें',
    friendTurn: '{name} की बारी — नंबर का इंतज़ार',
    turnTimeRemaining: 'सेकंड शेष',
    recentCalls: 'हाल के नंबर:',
    claimBingo: 'BINGO क्लेम करें!',
    linesCompletedCount: '{count}/5 लाइनें',
    friendDisconnected: 'दोस्त का नेटवर्क टूटा। {seconds} सेकंड प्रतीक्षा...',
    openedInAnotherTab: 'दूसरे टैब में खुल गया। यह सत्र बंद है।',

    // Result
    victory: 'शानदार जीत!',
    defeat: 'हार गए',
    youWon: 'आपने 5 लाइनें पूरी कीं और BINGO जीत लिया!',
    friendWon: '{name} ने 5 लाइनें पूरी करके BINGO जीत लिया!',
    forfeitVictory: 'दोस्त डिस्कनेक्ट हो गया। आप जीत गए!',
    rematch: 'फिर से खेलें (रीमैच)',
    rematchRequested: 'रीमैच की माँग भेजी गई...',
    leave: 'कमरा छोड़ें',
    shareCard: 'रिजल्ट शेयर करें',

    // Settings
    language: 'भाषा (Language)',
    background: 'बैकग्राउंड थीम',
    themeIndigo: 'नाइट इंडिगो',
    themeOcean: 'ओशन ब्लू',
    themePlum: 'प्लम वॉयलेट',
    themeForest: 'फॉरेस्ट ग्रीन',
    sound: 'आवाज़ (Sound)',
    vibration: 'वाइब्रेशन',
    reduceMotion: 'मोशन कम करें',
    close: 'बंद करें',

    // How to Play
    rule1Title: '1. कार्ड सजाएँ',
    rule1Desc: 'अपने 5x5 नोटबुक पेज पर 1-25 नंबर बदलें या ऑटो सेट दबाएँ।',
    rule2Title: '2. लाइन काटें',
    rule2Desc: 'बारी-बारी से नंबर बोलें। कोई भी रो या कॉलम पूरा होने पर लाल पेन से लाइन कटती है और B-I-N-G-O अक्षर कटता है।',
    rule3Title: '3. BINGO बटन',
    rule3Desc: '5 लाइनें कटते ही सुनहरा BINGO बटन अनलॉक होगा। सबसे पहले दबाकर जीत हासिल करें!'
  }
};

let currentLang = 'en';
try {
  currentLang = localStorage.getItem('bingo_lang') || 'en';
} catch {}

export function setLanguage(lang) {
  if (STRINGS[lang]) {
    currentLang = lang;
    try {
      localStorage.setItem('bingo_lang', lang);
    } catch {}
    document.documentElement.lang = lang;
    return true;
  }
  return false;
}

export function getLanguage() {
  return currentLang;
}

export function t(key, replacements = {}) {
  const dict = STRINGS[currentLang] || STRINGS['en'];
  let text = dict[key] || STRINGS['en'][key] || key;
  for (const [k, val] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
  }
  return text;
}
