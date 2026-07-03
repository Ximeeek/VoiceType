export const translations = {
  en: {
    // Navigation & Header
    "nav.dashboard": "Dashboard",
    "nav.engines": "Speech Engines",
    "nav.models": "Model Browser",
    "nav.downloads": "Downloads",
    "nav.history": "History",
    "nav.settings": "Settings",
    "nav.about": "About",
    "app.title": "VoiceType Pro",

    // Dashboard Page
    "dash.dictation_control": "Dictation Control",
    "dash.status.idle": "Ready to dictate",
    "dash.status.listening": "Listening...",
    "dash.status.dictating": "Dictating...",
    "dash.status.processing": "Processing speech...",
    "dash.status.paused": "Dictation paused",
    "dash.status.error": "Engine error",
    "dash.substatus.idle": "Say trigger word or click orb to start",
    "dash.substatus.listening": "Detecting speech...",
    "dash.substatus.dictating": "Speak now, text will be typed automatically",
    "dash.substatus.processing": "Processing audio stream...",
    "dash.substatus.paused": "Trigger word listening paused",
    "dash.substatus.error": "Check settings and audio input",
    "dash.btn.pause": "Pause Listening",
    "dash.btn.resume": "Resume Listening",
    "dash.btn.force": "Force Dictation",
    "dash.recent_transcript": "Recent Transcript",
    "dash.trigger_words": "Trigger Words",
    "dash.trigger_input_placeholder": "New trigger word...",
    "dash.trigger_add_btn": "Add",
    "dash.no_triggers": "No trigger words",
    "dash.active_engine": "Active Engine",
    "dash.change_engine": "Change",
    "dash.session_stats": "Session Statistics",
    "dash.stat.dictations": "Dictations",
    "dash.stat.words_simple": "Words",
    "dash.recent_history": "Recent Transcripts",
    "dash.view_all": "View All",
    "dash.no_history": "No history yet",
    "dash.overlay.downloading_model": "Dictation is unavailable until the model is downloaded.",
    "dash.overlay.missing_model": "Selected speech engine is unavailable. You need to download the speech model file first.",
    "dash.overlay.btn_download": "Go to Downloads",

    // Speech Engines Page
    "engines.title": "Speech Recognition Engines",
    "engines.offline_header": "OFFLINE ENGINES - PREFERRED FOR CPU",
    "engines.offline_gpu_header": "OFFLINE ENGINES - GPU ACCELERATION (CUDA)",
    "engines.online_header": "CLOUD ENGINES - REQUIRE API KEY",
    "engines.badge.active": "Active",
    "engines.badge.select": "Select",
    "engines.card.vosk.desc": "Fast live typing / Low RAM usage",
    "engines.card.vosk.target": "For: lower-end PCs, smooth real-time dictation",
    "engines.card.whisper.desc": "High accuracy / No external Python dependencies",
    "engines.card.whisper.target": "For: CPU execution, native C++ code",
    "engines.card.faster_whisper.desc": "Maximum speed & quality / GPU (CUDA) support",
    "engines.card.faster_whisper.target": "For: PCs with NVIDIA GPUs (CUDA)",
    "engines.card.sherpa.desc": "Next-Gen Kaldi / Low latency streaming",
    "engines.card.sherpa.target": "For: optimized CPU streaming (ONNX)",
    "engines.card.deepgram.desc": "Best latency, real-time streaming",
    "engines.card.assemblyai.desc": "High accuracy, rich vocabulary",
    "engines.card.openai.desc": "Official OpenAI Whisper Cloud API",
    "engines.card.google.desc": "Google Cloud Speech-to-Text API",
    "engines.card.azure.desc": "Microsoft Azure Speech API",
    "engines.config.title_prefix": "Configuration:",
    "engines.vosk.model.small": "Micro (small - 50 MB)",
    "engines.vosk.model.standard": "Standard (big - 1.2 GB)",
    "engines.vosk.status_label": "Model status:",
    "engines.status.installed": "Downloaded",
    "engines.status.not_installed": "Not downloaded",
    "engines.whisper.use_gpu": "Use GPU (requires CUDA)",
    "engines.api.provider": "Provider:",
    "engines.api.estimated_cost": "Estimated cost:",
    "engines.api.btn_buy": "Get API Key ↗",
    "engines.api.key_label": "API Key",
    "engines.api.key_placeholder": "Paste your API key here",
    "engines.api.btn_test": "Test Connection",
    "engines.azure.region_label": "Azure Region (e.g. eastus)",
    "engines.tip.whisper": "<strong>Tip:</strong> Larger models offer higher accuracy, but require more CPU/RAM. Models smaller than 50MB (like Micro) may struggle with complex vocabulary.",
    "engines.tip.sherpa": "<strong>Tip:</strong> Sherpa-ONNX models download from official Next-Gen Kaldi releases and are optimized for real-time CPU streaming.",
    "engines.no_models_found": "No models available for the selected parameters",

    // Installed Models Manager
    "models.manager.title": "Downloaded Models Manager",
    "models.manager.total": "Total:",
    "models.manager.empty_group": "No downloaded models for this engine",
    "models.manager.delete": "Delete",
    "models.manager.delete_tooltip": "Delete this model",
    "models.manager.delete_all": "Delete all",

    // Downloads / Model Browser Page
    "downloads.title": "Download Manager",
    "downloads.subtitle": "Manage download queue and offline speech models.",
    "downloads.mode.label": "Download mode:",
    "downloads.mode.sequential": "Sequential",
    "downloads.mode.concurrent": "Concurrent",
    "downloads.quick.title": "Download New Speech Model",
    "downloads.quick.engine_lbl": "Speech Engine",
    "downloads.quick.lang_lbl": "Language",
    "downloads.quick.model_lbl": "Speech Model",
    "downloads.quick.btn": "Download Model",
    "downloads.quick.all_langs": "All Languages (Multilingual)",
    "downloads.active.title": "Active Downloads",
    "downloads.active.empty": "No active downloads. Select a model above to begin.",
    "downloads.history.title": "Download History",
    "downloads.history.clear": "Clear History",
    "downloads.history.empty": "No download history.",

    // History Page
    "history.title": "Dictation History",
    "history.empty": "No dictation history recorded in this session.",
    "history.btn.clear": "Clear History",
    "history.btn.copy": "Copy All",

    // Settings Navigation Tabs
    "settings.tab.general": "General",
    "settings.tab.engine": "Speech Engine",
    "settings.tab.appearance": "Appearance",

    // General Settings
    "settings.trigger.title": "Trigger Words",
    "settings.trigger.placeholder": "Add trigger word...",
    "settings.trigger.btn_add": "Add",
    "settings.trigger.fuzzy": "Fuzzy matching (tolerates pronunciation typos ±2 letters)",
    "settings.trigger.translate": "Translate trigger words to speech engine language",
    "settings.stop.title": "Stop Dictation",
    "settings.stop.placeholder": "Add stop word...",
    "settings.stop.btn_add": "Add",
    "settings.stop.silence_limit": "Silence timeout",
    "settings.stop.remove_word": "Remove stop word from typed text",
    "settings.behavior.title": "Behavior & System",
    "settings.lang.label": "Application Language",
    "settings.mic.label": "Microphone Input",
    "settings.mic.default": "Default Device",
    "settings.autostart": "Autostart with Windows",
    "settings.clipboard_fallback": "Copy to clipboard when no text field is focused",
    "settings.clipboard_toast": "Show notification when copied to clipboard",
    "settings.start_delay": "Start delay",
    "settings.no_stops": "No stop words",

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

    // About Page
    "about.desc": "Ultra-lightweight, local desktop application for real-time voice dictation.",
    "about.tech.rust.title": "Rust Core Stack",
    "about.tech.rust.desc": "Core engine written in Rust for maximum memory safety, optimized CPU usage, and instant startup without heavy Electron overhead.",
    "about.tech.vad.title": "DSP & Silero VAD v4",
    "about.tech.vad.desc": "Audio processing via CPAL library with built-in noise filtering and Silero Voice Activity Detection at 30ms precision.",
    "about.tech.win32.title": "Win32 UI Automation",
    "about.tech.win32.desc": "Direct Unicode character injection into active text field in any Windows app with Clipboard fallback.",
    "about.telemetry.title": "SYSTEM TELEMETRY // LIVE RUNTIME STATS",
    "about.telemetry.host": "HOST:",
    "about.telemetry.thread_pool": "THREAD POOL:",
    "about.telemetry.audio_latency": "AUDIO LATENCY:",
    "about.telemetry.mem_footprint": "MEMORY FOOTPRINT:",
    "about.telemetry.gpu_tensor": "GPU ACCELERATION:",
    "about.addons.title": "Downloaded Addons & Systems",
    "about.addons.desc": "Manage and clean up downloaded environments (Python, CUDA), speech models, and translator.",
    "about.addons.btn": "View All Downloaded Addons",
    "about.addons.modal_title": "Downloaded Addons & System Components",
    "about.reset.title": "Reset Application Settings",
    "about.reset.desc": "Restores default configuration for speech engines and trigger words.",
    "about.reset.btn": "Reset Configuration",

    // Modals & General Elements
    "engines.python.modal_title": "Python Environment Required",
    "engines.python.desc": "To use Faster-Whisper engines, the application needs an integrated Python environment. Would you like to download and install it automatically?",
    "engines.python.btn_install": "Install Automatically",
    "engines.python.initializing": "Initializing...",
    "addons.py.title": "Integrated Python Embed",
    "addons.py.installed": "Installed (~500 MB)",
    "addons.py.not_installed": "Not installed",
    "addons.py.remove_btn": "Remove Python",
    "addons.models.empty": "No installed models",
    "btn.save": "Save Changes",
    "btn.cancel": "Cancel",
    "btn.close": "Close",
    "btn.apply": "Apply Settings",

    // Toasts
    "toast.trigger_added": "Trigger word added",
    "toast.trigger_updated": "Trigger words updated",
    "toast.stop_added": "Stop word added",
    "toast.stop_updated": "Stop words updated",
    "toast.word_registered": "Word already registered",
    "toast.mic_updated": "Microphone updated",
    "toast.update_failed": "Update failed",
    "toast.download_started": "Download started",
    "toast.download_finished": "Download complete",
    "toast.download_cancelled": "Download cancelled",
    "toast.download_error": "Download error",
    "toast.model_deleted": "Model deleted",
    "toast.model_delete_error": "Failed to delete model",
    "toast.all_models_deleted": "All models deleted",
    "toast.engine_error": "Engine Error",
    "toast.no_text_field": "No active text field",
    "toast.clipboard_fallback_msg": "Dictated text will fall back to clipboard.",
    "toast.force_dictate": "Force Dictation Triggered",
    "toast.force_dictate_msg": "Start speaking without trigger word.",
    "toast.listening_resumed": "Listening resumed",
    "toast.listening_paused": "Listening paused",
    "toast.reset_success": "Settings reset to defaults",
    "toast.conn_test_success": "Connection test successful",
    "toast.conn_test_failed": "Connection test failed",

    // Updater
    "updater.bg_updating": "Updating application in background...",
    "updater.downloading": "Downloading update {version}...",
    "updater.downloaded_msg": "Downloaded {progress}% of update release.",
    "updater.ready_title": "Update {version} ready!",
    "updater.ready_msg": "New application version downloaded and ready to install.",
    "updater.btn_later": "Later",
    "updater.btn_install": "Install & Relaunch"
  },
  pl: {
    // Navigation & Header
    "nav.dashboard": "Pulpit",
    "nav.engines": "Silniki mowy",
    "nav.models": "Przeglądarka modeli",
    "nav.downloads": "Pobieranie",
    "nav.history": "Historia",
    "nav.settings": "Ustawienia",
    "nav.about": "O programie",
    "app.title": "VoiceType Pro",

    // Dashboard Page
    "dash.dictation_control": "Sterowanie dyktowaniem",
    "dash.status.idle": "Gotowy do dyktowania",
    "dash.status.listening": "Słucham...",
    "dash.status.dictating": "Dyktowanie...",
    "dash.status.processing": "Przetwarzanie mowy...",
    "dash.status.paused": "Dyktowanie wstrzymane",
    "dash.status.error": "Błąd silnika",
    "dash.substatus.idle": "Powiedz frazę aktywującą lub kliknij kulę",
    "dash.substatus.listening": "Wykrywanie mowy...",
    "dash.substatus.dictating": "Mów teraz, tekst zostanie automatycznie wpisany",
    "dash.substatus.processing": "Przetwarzanie strumienia audio...",
    "dash.substatus.paused": "Nasłuch fraz aktywujących wstrzymany",
    "dash.substatus.error": "Sprawdź ustawienia i wejście audio",
    "dash.btn.pause": "Wstrzymaj nasłuch",
    "dash.btn.resume": "Wznów nasłuch",
    "dash.btn.force": "Wymuś dyktowanie",
    "dash.recent_transcript": "Ostatnia transkrypcja",
    "dash.trigger_words": "Frazy aktywujące",
    "dash.trigger_input_placeholder": "Nowa fraza aktywująca...",
    "dash.trigger_add_btn": "Dodaj",
    "dash.no_triggers": "Brak fraz aktywujących",
    "dash.active_engine": "Aktywny silnik",
    "dash.change_engine": "Zmień",
    "dash.session_stats": "Statystyki sesji",
    "dash.stat.dictations": "Dyktowania",
    "dash.stat.words_simple": "Słowa",
    "dash.recent_history": "Ostatnie transkrypcje",
    "dash.view_all": "Zobacz wszystkie",
    "dash.no_history": "Brak historii",
    "dash.overlay.downloading_model": "Nie można używać dyktowania, dopóki model się nie pobierze.",
    "dash.overlay.missing_model": "Wybrany silnik mowy jest niedostępny. Musisz pobrać plik mowy silnikowej (model), aby dyktować.",
    "dash.overlay.btn_download": "Przejdź do Pobierania",

    // Speech Engines Page
    "engines.title": "Silniki rozpoznawania mowy",
    "engines.offline_header": "SILNIKI OFFLINE - PREFEROWANE DLA CPU",
    "engines.offline_gpu_header": "SILNIKI OFFLINE - AKCELERACJA GPU (CUDA)",
    "engines.online_header": "SILNIKI CHMUROWE - WYMAGAJĄ KLUCZA API",
    "engines.badge.active": "Aktywny",
    "engines.badge.select": "Wybierz",
    "engines.card.vosk.desc": "Szybki live typing / Niskie zużycie RAM",
    "engines.card.vosk.target": "Dla: słabsze PC, płynne dyktowanie na żywo",
    "engines.card.whisper.desc": "Wysoka dokładność / Bez zewnętrznych zależności Pythona",
    "engines.card.whisper.target": "Dla: praca na CPU, natywny kod C++",
    "engines.card.faster_whisper.desc": "Najwyższa szybkość i jakość / Obsługa GPU (CUDA)",
    "engines.card.faster_whisper.target": "Dla: PC z kartą graficzną NVIDIA (GPU)",
    "engines.card.sherpa.desc": "Next-Gen Kaldi / Niskie opóźnienie",
    "engines.card.sherpa.target": "Dla: zoptymalizowana praca na CPU (ONNX)",
    "engines.card.deepgram.desc": "Najlepsza latencja, live typing",
    "engines.card.assemblyai.desc": "Dobra jakość, bogaty słownik",
    "engines.card.openai.desc": "Oficjalne API OpenAI Whisper w chmurze",
    "engines.card.google.desc": "API Google Cloud Speech-to-Text",
    "engines.card.azure.desc": "API Microsoft Azure Speech",
    "engines.config.title_prefix": "Konfiguracja:",
    "engines.vosk.model.small": "Mikro (small - 50 MB)",
    "engines.vosk.model.standard": "Standardowy (big - 1.2 GB)",
    "engines.vosk.status_label": "Status modelu:",
    "engines.status.installed": "Pobrany",
    "engines.status.not_installed": "Nie pobrany",
    "engines.whisper.use_gpu": "Użyj GPU (wymaga CUDA)",
    "engines.api.provider": "Dostawca:",
    "engines.api.estimated_cost": "Szacowany koszt:",
    "engines.api.btn_buy": "Kup / Załóż konto API ↗",
    "engines.api.key_label": "Klucz API",
    "engines.api.key_placeholder": "Wklej klucz API",
    "engines.api.btn_test": "Testuj połączenie",
    "engines.azure.region_label": "Region Azure (np. eastus)",
    "engines.tip.whisper": "<strong>Wskazówka:</strong> Im większy model, tym wyższa dokładność rozpoznawania mowy, ale też większe obciążenie procesora i pamięci RAM. Modele mniejsze niż 50 MB (jak Mikro) mogą mieć trudności z poprawną interpretacją polskich końcówek i specyficznych wyrazów.",
    "engines.tip.sherpa": "<strong>Wskazówka:</strong> Modele Sherpa-ONNX pobierają się z oficjalnych wydań Next-Gen Kaldi i są optymalizowane pod kątem szybkiego wnioskowania na CPU w czasie rzeczywistym.",
    "engines.no_models_found": "Brak dostępnych modeli dla wybranych parametrów",

    // Installed Models Manager
    "models.manager.title": "Menedżer Pobranych Modeli",
    "models.manager.total": "Razem:",
    "models.manager.empty_group": "Brak pobranych modeli dla tego silnika",
    "models.manager.delete": "Usuń",
    "models.manager.delete_tooltip": "Usuń ten model",
    "models.manager.delete_all": "Usuń wszystkie",

    // Downloads / Model Browser Page
    "downloads.title": "Menedżer Pobierania",
    "downloads.subtitle": "Zarządzaj kolejką pobierania modeli mowy dla silników offline.",
    "downloads.mode.label": "Tryb pobierania:",
    "downloads.mode.sequential": "Pobieraj po kolei",
    "downloads.mode.concurrent": "Pobieraj na raz",
    "downloads.quick.title": "Pobierz nowy model mowy",
    "downloads.quick.engine_lbl": "Silnik mowy",
    "downloads.quick.lang_lbl": "Język",
    "downloads.quick.model_lbl": "Model mowy",
    "downloads.quick.btn": "Pobierz model",
    "downloads.quick.all_langs": "Wszystkie języki (Multilingual)",
    "downloads.active.title": "Aktywne Pobierania",
    "downloads.active.empty": "Brak aktywnych pobierań. Wybierz model powyżej, aby rozpocząć.",
    "downloads.history.title": "Historia Pobierania",
    "downloads.history.clear": "Wyczyść historię",
    "downloads.history.empty": "Brak historii pobierania.",

    // History Page
    "history.title": "Historia dyktowania",
    "history.empty": "Brak zarejestrowanej historii w tej sesji.",
    "history.btn.clear": "Wyczyść historię",
    "history.btn.copy": "Kopiuj wszystko",

    // Settings Navigation Tabs
    "settings.tab.general": "Ogólne",
    "settings.tab.engine": "Silnik mowy",
    "settings.tab.appearance": "Wygląd",

    // General Settings
    "settings.trigger.title": "Frazy aktywujące",
    "settings.trigger.placeholder": "Dodaj frazę aktywującą...",
    "settings.trigger.btn_add": "Dodaj",
    "settings.trigger.fuzzy": "Fuzzy matching (toleruje błędy wymowy ±2 litery)",
    "settings.trigger.translate": "Tłumacz frazy aktywujące na język silnika",
    "settings.stop.title": "Zatrzymanie dyktowania",
    "settings.stop.placeholder": "Dodaj stop word...",
    "settings.stop.btn_add": "Dodaj",
    "settings.stop.silence_limit": "Limit ciszy",
    "settings.stop.remove_word": "Usuń stop word z wpisanego tekstu",
    "settings.behavior.title": "Zachowanie i system",
    "settings.lang.label": "Język aplikacji",
    "settings.mic.label": "Mikrofon",
    "settings.mic.default": "Urządzenie domyślne",
    "settings.autostart": "Autostart z Windows",
    "settings.clipboard_fallback": "Kopiuj do schowka gdy brak pola tekstowego",
    "settings.clipboard_toast": "Pokaż komunikat przy kopiowaniu",
    "settings.start_delay": "Opóźnienie startu",
    "settings.no_stops": "Brak stop words",

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

    // About Page
    "about.desc": "Ultra-lekka, lokalna aplikacja desktopowa do wpisywania tekstu mową w czasie rzeczywistym.",
    "about.tech.rust.title": "Rust Core Stack",
    "about.tech.rust.desc": "Silnik główny napisany w Rust dla maksymalnego bezpieczeństwa pamięci, zoptymalizowanego zużycia CPU oraz natychmiastowego startu bez ciężkiego środowiska Electron.",
    "about.tech.vad.title": "DSP & Silero VAD v4",
    "about.tech.vad.desc": "Przetwarzanie audio za pomocą biblioteki CPAL z wbudowaną filtracją szumów oraz detekcją głosu (Voice Activity Detection) Silero z dokładnością 30ms.",
    "about.tech.win32.title": "Win32 UI Automation",
    "about.tech.win32.desc": "Bezpośrednie wstrzykiwanie znaków Unicode do aktywnego pola tekstowego w dowolnej aplikacji Windows z buforem bezpieczeństwa Clipboard fallback.",
    "about.telemetry.title": "TELEMETRIA SYSTEMU // STATYSTYKI NA ŻYWO",
    "about.telemetry.host": "HOST:",
    "about.telemetry.thread_pool": "PULA WĄTKÓW:",
    "about.telemetry.audio_latency": "OPÓŹNIENIE AUDIO:",
    "about.telemetry.mem_footprint": "ZUŻYCIE PAMIĘCI:",
    "about.telemetry.gpu_tensor": "AKCELERACJA GPU:",
    "about.addons.title": "Zarządzanie Pobranymi Dodatkami",
    "about.addons.desc": "Zarządzaj i usuwaj pobrane środowiska (Python, CUDA), modele mowy oraz tłumacz.",
    "about.addons.btn": "Zobacz wszystkie pobrane dodatki",
    "about.addons.modal_title": "Pobrane Dodatki i Komponenty Systemowe",
    "about.reset.title": "Reset Ustawień Aplikacji",
    "about.reset.desc": "Przywraca domyślną konfigurację silników i fraz aktywujących.",
    "about.reset.btn": "Resetuj konfigurację",

    // Modals & General Elements
    "engines.python.modal_title": "Wymagana instalacja środowiska Python",
    "engines.python.desc": "Aby korzystać z silników Faster-Whisper, aplikacja potrzebuje zintegrowanego środowiska Python. Czy chcesz pobrać i zainstalować je teraz automatycznie?",
    "engines.python.btn_install": "Zainstaluj automatycznie",
    "engines.python.initializing": "Inicjalizacja...",
    "addons.py.title": "Zintegrowany Python Embed",
    "addons.py.installed": "Zainstalowano (~500 MB)",
    "addons.py.not_installed": "Brak / Nie zainstalowano",
    "addons.py.remove_btn": "Usuń Python",
    "addons.models.empty": "Brak zainstalowanych modeli",
    "btn.save": "Zapisz zmiany",
    "btn.cancel": "Anuluj",
    "btn.close": "Zamknij",
    "btn.apply": "Zastosuj zmiany",

    // Toasts
    "toast.trigger_added": "Dodano frazę aktywującą",
    "toast.trigger_updated": "Zaktualizowano frazy aktywujące",
    "toast.stop_added": "Dodano stop word",
    "toast.stop_updated": "Zaktualizowano stop words",
    "toast.word_registered": "Słowo jest już zarejestrowane",
    "toast.mic_updated": "Zaktualizowano mikrofon",
    "toast.update_failed": "Błąd aktualizacji",
    "toast.download_started": "Rozpoczęto pobieranie",
    "toast.download_finished": "Pobieranie ukończone",
    "toast.download_cancelled": "Anulowano pobieranie",
    "toast.download_error": "Błąd pobierania",
    "toast.model_deleted": "Usunięto model",
    "toast.model_delete_error": "Błąd usuwania modelu",
    "toast.all_models_deleted": "Usunięto wszystkie modele",
    "toast.engine_error": "Błąd silnika",
    "toast.no_text_field": "Brak aktywnego pola tekstowego",
    "toast.clipboard_fallback_msg": "Podyktowany tekst zostanie skopiowany do schowka.",
    "toast.force_dictate": "Wymuszono dyktowanie",
    "toast.force_dictate_msg": "Zacznij mówić bez frazy aktywującej.",
    "toast.listening_resumed": "Wznowiono nasłuch",
    "toast.listening_paused": "Wstrzymano nasłuch",
    "toast.reset_success": "Przywrócono domyślne ustawienia",
    "toast.conn_test_success": "Test połączenia udany",
    "toast.conn_test_failed": "Błąd testu połączenia",

    // Updater
    "updater.bg_updating": "Aktualizuję aplikację w tle...",
    "updater.downloading": "Pobieranie aktualizacji {version}...",
    "updater.downloaded_msg": "Pobrano {progress}% wygenerowanej paczki wydań.",
    "updater.ready_title": "Aktualizacja {version} gotowa!",
    "updater.ready_msg": "Nowa wersja aplikacji została pobrana i przygotowana do instalacji.",
    "updater.btn_later": "Później",
    "updater.btn_install": "Zainstaluj i uruchom ponownie"
  }
};

let currentLanguage = 'en';
const onLanguageChangeListeners = [];

export function getLanguage() {
  return currentLanguage;
}

export function onLanguageChange(fn) {
  if (typeof fn === 'function') {
    onLanguageChangeListeners.push(fn);
  }
}

export function t(key, params = {}) {
  const langObj = translations[currentLanguage] || translations['en'];
  let text = langObj[key] || translations['en'][key] || key;
  
  if (params && typeof params === 'object') {
    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
  }
  
  return text;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
  } else {
    currentLanguage = 'en';
  }
  updateDOMTranslations();
  onLanguageChangeListeners.forEach(listener => {
    try {
      listener(currentLanguage);
    } catch (e) {
      console.error('[i18n] Listener error:', e);
    }
  });
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
