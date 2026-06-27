export const translations = {
  en: {
    // Navigation & Header
    "nav.dashboard": "Dashboard",
    "nav.engines": "Speech Engines",
    "nav.models": "Model Browser",
    "nav.history": "History",
    "nav.settings": "Settings",
    "app.title": "VoiceType Pro",

    // Dashboard Page
    "dash.status.idle": "Ready to dictate",
    "dash.status.listening": "Listening...",
    "dash.status.dictating": "Dictating...",
    "dash.status.processing": "Processing speech...",
    "dash.status.paused": "Dictation paused",
    "dash.status.error": "Engine error",
    "dash.substatus.idle": "Say trigger word or click orb to start",
    "dash.substatus.listening": "Detecting speech...",
    "dash.substatus.dictating": "Speak now, text will be typed automatically",
    "dash.substatus.processing": "Converting m4a/wav audio stream...",
    "dash.substatus.paused": "Hotword listening temporarily paused",
    "dash.substatus.error": "Check settings and audio input",
    "dash.quick_actions": "Quick Controls",
    "dash.btn.pause": "Pause Listening",
    "dash.btn.resume": "Resume Listening",
    "dash.btn.force": "Force Dictation",
    "dash.session_stats": "Session Statistics",
    "dash.stat.words": "Words Dictated",
    "dash.stat.time": "Active Dictation",
    "dash.stat.accuracy": "VAD Detections",
    "dash.live_preview": "Live Text Preview",
    "dash.placeholder_preview": "Dictated text will appear here in real-time...",

    // Speech Engines Page
    "engines.title": "Speech Recognition Engines",
    "engines.offline_header": "OFFLINE ENGINES - PREFERRED FOR CPU/GPU",
    "engines.online_header": "CLOUD ENGINES - REQUIRE API KEY",
    "engines.badge.active": "Active",
    "engines.badge.select": "Select",
    "engines.card.vosk.desc": "Ultra-fast lightweight offline recognition for Polish & English.",
    "engines.card.whisper.desc": "High-accuracy OpenAI Whisper model running locally via whisper.cpp.",
    "engines.card.faster_whisper.desc": "Optimized C++ implementation of Whisper for fast GPU/CPU inference.",
    "engines.card.sherpa.desc": "Next-gen Kaldi sherpa-onnx offline streaming engine.",
    "engines.card.deepgram.desc": "Real-time enterprise cloud STT with exceptional accuracy.",
    "engines.card.assemblyai.desc": "Cloud speech recognition with rich vocabulary support.",
    "engines.card.openai.desc": "Official OpenAI Whisper API for cloud dictation.",
    "engines.card.google.desc": "Google Cloud Speech-to-Text API.",
    "engines.card.azure.desc": "Microsoft Azure Cognitive Services Speech API.",

    // Model Browser Page
    "models.title": "Local Speech Models",
    "models.subtitle": "Download and manage offline models for Vosk, Whisper, and Sherpa-ONNX.",
    "models.btn.download": "Download",
    "models.btn.downloading": "Downloading...",
    "models.btn.installed": "Installed",
    "models.btn.delete": "Delete",

    // History Page
    "history.title": "Dictation History",
    "history.empty": "No dictation history recorded in this session.",
    "history.btn.clear": "Clear History",
    "history.btn.copy": "Copy All",

    // Settings Navigation Tabs
    "settings.tab.general": "General",
    "settings.tab.engine": "Speech Engine",
    "settings.tab.appearance": "Appearance",

    // General Settings Card 1: Trigger Words
    "settings.trigger.title": "Trigger Words",
    "settings.trigger.placeholder": "Add trigger word...",
    "settings.trigger.btn_add": "Add",
    "settings.trigger.fuzzy": "Fuzzy matching (tolerates pronunciation typos ±2 letters)",
    "settings.trigger.translate": "Translate trigger words to speech engine language",

    // General Settings Card 2: Stop Dictation
    "settings.stop.title": "Stop Dictation",
    "settings.stop.placeholder": "Add stop word...",
    "settings.stop.btn_add": "Add",
    "settings.stop.silence_limit": "Silence timeout",
    "settings.stop.remove_word": "Remove stop word from typed text",

    // General Settings Card 3: Behavior & App Language
    "settings.behavior.title": "Behavior & System",
    "settings.lang.label": "Application Language",
    "settings.mic.label": "Microphone Input",
    "settings.mic.default": "Default Device",
    "settings.autostart": "Autostart with Windows",
    "settings.clipboard_fallback": "Copy to clipboard when no text field is focused",
    "settings.clipboard_toast": "Show notification when copied to clipboard",
    "settings.start_delay": "Start delay",

    // Speech Engine Settings Tab
    "settings.engine.lang_title": "Speech Recognition Language",
    "settings.engine.test_btn": "Test Engine Connection",
    "settings.engine.save_btn": "Save Engine Settings",

    // Appearance Settings Tab
    "appearance.theme.title": "Color Theme",
    "appearance.theme.dark": "Dark Theme",
    "appearance.theme.light": "Light Theme",
    "appearance.accent.title": "Accent Color Preset",
    "appearance.accent.dual_toggle": "Dual Color Accent Mode (Gradient)",
    "appearance.accent.neon": "Neon (Default)",
    "appearance.accent.electric": "Electric",
    "appearance.accent.plasma": "Plasma",
    "appearance.accent.amber": "Amber",
    "appearance.accent.rose": "Rose",
    "appearance.accent.arctic": "Arctic",
    "appearance.accent.custom": "Custom Colors",
    "appearance.accent.main_label": "Primary Accent",
    "appearance.accent.sec_label": "Secondary Accent",
    "appearance.orb.title": "Orb Style Signature",
    "appearance.orb.liquid": "Liquid (Morphing Blob)",
    "appearance.orb.pulse": "Pulse (Radar Ping Rings)",
    "appearance.orb.neon_ring": "Neon Ring (Outline Glow)",
    "appearance.orb.crystal": "Crystal (Sharp Edges)",
    "appearance.orb.minimal": "Minimal (Indicator Dot)",
    "appearance.bg.title": "Window Background",
    "appearance.bg.void": "Void (Pure #080c08)",
    "appearance.bg.grid": "Grid (Subtle 1px Mesh)",
    "appearance.bg.dots": "Dots (Dot Matrix)",
    "appearance.bg.clean": "Clean (Flat Solid)",
    "appearance.density.title": "UI Density",
    "appearance.density.comfortable": "Comfortable (Default)",
    "appearance.density.compact": "Compact (-30% Spacing)",
    "appearance.density.spacious": "Spacious (+20% Spacing)",
    "appearance.anim.title": "Animation Intensity",
    "appearance.anim.full": "Full (All Motion & Glows)",
    "appearance.anim.subtle": "Subtle (-60% Reduced Motion)",
    "appearance.anim.none": "None (Zero Animations)",
    "appearance.opacity.title": "Window Transparency",
    "appearance.opacity.subtext": "Requires window to not be maximized.",

    // Modals & General Buttons
    "btn.save": "Save Changes",
    "btn.cancel": "Cancel",
    "btn.close": "Close",
    "btn.apply": "Apply Settings"
  },
  pl: {
    // Navigation & Header
    "nav.dashboard": "Pulpit",
    "nav.engines": "Silniki mowy",
    "nav.models": "Przeglądarka modeli",
    "nav.history": "Historia",
    "nav.settings": "Ustawienia",
    "app.title": "VoiceType Pro",

    // Dashboard Page
    "dash.status.idle": "Gotowy do dyktowania",
    "dash.status.listening": "Słucham...",
    "dash.status.dictating": "Dyktowanie...",
    "dash.status.processing": "Przetwarzanie mowy...",
    "dash.status.paused": "Dyktowanie wstrzymane",
    "dash.status.error": "Błąd silnika",
    "dash.substatus.idle": "Powiedz słowo wyzwalające lub kliknij kulę",
    "dash.substatus.listening": "Wykrywanie mowy...",
    "dash.substatus.dictating": "Mów teraz, tekst zostanie automatycznie wpisany",
    "dash.substatus.processing": "Przetwarzanie strumienia audio...",
    "dash.substatus.paused": "Nasłuch słowa wyzwalającego wstrzymany",
    "dash.substatus.error": "Sprawdź ustawienia i wejście audio",
    "dash.quick_actions": "Szybka kontrola",
    "dash.btn.pause": "Wstrzymaj nasłuch",
    "dash.btn.resume": "Wznów nasłuch",
    "dash.btn.force": "Wymuś dyktowanie",
    "dash.session_stats": "Statystyki sesji",
    "dash.stat.words": "Podyktowane słowa",
    "dash.stat.time": "Czas dyktowania",
    "dash.stat.accuracy": "Wykrycia VAD",
    "dash.live_preview": "Podgląd na żywo",
    "dash.placeholder_preview": "Podyktowany tekst pojawi się tutaj w czasie rzeczywistym...",

    // Speech Engines Page
    "engines.title": "Silniki rozpoznawania mowy",
    "engines.offline_header": "SILNIKI OFFLINE - PREFEROWANE DLA CPU/GPU",
    "engines.online_header": "SILNIKI CHMUROWE - WYMAGAJĄ KLUCZA API",
    "engines.badge.active": "Aktywny",
    "engines.badge.select": "Wybierz",
    "engines.card.vosk.desc": "Ultraszybkie, lekkie rozpoznawanie offline dla polskiego i angielskiego.",
    "engines.card.whisper.desc": "Wysokiej dokładności model OpenAI Whisper uruchamiany lokalnie przez whisper.cpp.",
    "engines.card.faster_whisper.desc": "Zoptymalizowana implementacja C++ Whisper dla szybkiego GPU/CPU.",
    "engines.card.sherpa.desc": "Silnik strumieniowy Kaldi sherpa-onnx nowej generacji.",
    "engines.card.deepgram.desc": "Chmurowe STT w czasie rzeczywistym o wyjątkowej dokładności.",
    "engines.card.assemblyai.desc": "Chmurowe rozpoznawanie mowy z bogatym słownikiem.",
    "engines.card.openai.desc": "Oficjalne API OpenAI Whisper do dyktowania w chmurze.",
    "engines.card.google.desc": "API Google Cloud Speech-to-Text.",
    "engines.card.azure.desc": "API Microsoft Azure Cognitive Services Speech.",

    // Model Browser Page
    "models.title": "Lokalne modele mowy",
    "models.subtitle": "Pobieraj i zarządzaj modelami offline dla Vosk, Whisper i Sherpa-ONNX.",
    "models.btn.download": "Pobierz",
    "models.btn.downloading": "Pobieranie...",
    "models.btn.installed": "Zainstalowano",
    "models.btn.delete": "Usuń",

    // History Page
    "history.title": "Historia dyktowania",
    "history.empty": "Brak zarejestrowanej historii w tej sesji.",
    "history.btn.clear": "Wyczyść historię",
    "history.btn.copy": "Kopiuj wszystko",

    // Settings Navigation Tabs
    "settings.tab.general": "Ogólne",
    "settings.tab.engine": "Silnik mowy",
    "settings.tab.appearance": "Wygląd",

    // General Settings Card 1: Trigger Words
    "settings.trigger.title": "Słowa wyzwalające",
    "settings.trigger.placeholder": "Dodaj słowo wyzwalające...",
    "settings.trigger.btn_add": "Dodaj",
    "settings.trigger.fuzzy": "Fuzzy matching (toleruje błędy wymowy ±2 litery)",
    "settings.trigger.translate": "Tłumacz słowa wyzwalające na język silnika",

    // General Settings Card 2: Stop Dictation
    "settings.stop.title": "Zatrzymanie dyktowania",
    "settings.stop.placeholder": "Dodaj stop word...",
    "settings.stop.btn_add": "Dodaj",
    "settings.stop.silence_limit": "Limit ciszy",
    "settings.stop.remove_word": "Usuń stop word z wpisanego tekstu",

    // General Settings Card 3: Behavior & App Language
    "settings.behavior.title": "Zachowanie i system",
    "settings.lang.label": "Język aplikacji",
    "settings.mic.label": "Mikrofon",
    "settings.mic.default": "Urządzenie domyślne",
    "settings.autostart": "Autostart z Windows",
    "settings.clipboard_fallback": "Kopiuj do schowka gdy brak pola tekstowego",
    "settings.clipboard_toast": "Pokaż komunikat przy kopiowaniu",
    "settings.start_delay": "Opóźnienie startu",

    // Speech Engine Settings Tab
    "settings.engine.lang_title": "Język rozpoznawania mowy",
    "settings.engine.test_btn": "Testuj połączenie silnika",
    "settings.engine.save_btn": "Zapisz ustawienia silnika",

    // Appearance Settings Tab
    "appearance.theme.title": "Motyw kolorystyczny",
    "appearance.theme.dark": "Motyw ciemny",
    "appearance.theme.light": "Motyw jasny",
    "appearance.accent.title": "Paleta akcentu",
    "appearance.accent.dual_toggle": "Włącz dwukolorowy akcent (Gradient)",
    "appearance.accent.neon": "Neon (Domyślny)",
    "appearance.accent.electric": "Electric",
    "appearance.accent.plasma": "Plasma",
    "appearance.accent.amber": "Amber",
    "appearance.accent.rose": "Rose",
    "appearance.accent.arctic": "Arctic",
    "appearance.accent.custom": "Własne kolory",
    "appearance.accent.main_label": "Główny akcent",
    "appearance.accent.sec_label": "Drugorzędny akcent",
    "appearance.orb.title": "Styl Kuli (Orb Signature)",
    "appearance.orb.liquid": "Liquid (Płynna kula)",
    "appearance.orb.pulse": "Pulse (Radarowe pierścienie)",
    "appearance.orb.neon_ring": "Neon Ring (Intensywny obrys)",
    "appearance.orb.crystal": "Crystal (Ostre krawędzie)",
    "appearance.orb.minimal": "Minimal (Mały wskaźnik)",
    "appearance.bg.title": "Tło okna",
    "appearance.bg.void": "Void (Czysty #080c08)",
    "appearance.bg.grid": "Grid (Subtelna siatka)",
    "appearance.bg.dots": "Dots (Matryca kropek)",
    "appearance.bg.clean": "Clean (Gładka czerń)",
    "appearance.density.title": "Gęstość UI (Density)",
    "appearance.density.comfortable": "Comfortable (Domyślna)",
    "appearance.density.compact": "Compact (-30% odstępów)",
    "appearance.density.spacious": "Spacious (+20% odstępów)",
    "appearance.anim.title": "Intensywność animacji",
    "appearance.anim.full": "Pełne (Wszystkie efekty)",
    "appearance.anim.subtle": "Subtelne (-60% ruchu)",
    "appearance.anim.none": "Brak animacji (Statyczne)",
    "appearance.opacity.title": "Przezroczystość okna",
    "appearance.opacity.subtext": "Wymaga niezmaksymalizowanego okna.",

    // Modals & General Buttons
    "btn.save": "Zapisz zmiany",
    "btn.cancel": "Anuluj",
    "btn.close": "Zamknij",
    "btn.apply": "Zastosuj"
  }
};

let currentLanguage = 'en';

export function getLanguage() {
  return currentLanguage;
}

export function t(key) {
  const langObj = translations[currentLanguage] || translations['en'];
  return langObj[key] || translations['en'][key] || key;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
  } else {
    currentLanguage = 'en';
  }
  updateDOMTranslations();
}

export function updateDOMTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const translated = t(key);
    if (attr) {
      el.setAttribute(attr, translated);
    } else {
      el.textContent = translated;
    }
  });
}
