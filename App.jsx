import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import logoImg from "./logo.jpg";
import promoImg from "./promo.jpg";
import sndKeyboardClick from "./sound-keyboard-click.mp3";
import sndNotification from "./notification-sound.mp3";
import sndAccept from "./accept-sound.mp3";
import sndTick from "./tick-sound.mp3";
import sndModernClick from "./sound-modern-click.wav";
import sndHardTypewriter from "./sound-hard-typewriter.wav";
import sndSoftTypewriter from "./sound-soft-typewriter.wav";
import sndBubbleClick from "./sound-bubble-click.wav";
import sndMouseClick from "./sound-mouse-click.wav";
import {
  Trophy,
  LogIn,
  LogOut,
  Users,
  UserPlus,
  User as UserIcon,
  Plus,
  X,
  Check,
  Swords,
  Settings,
  ShieldPlus,
  Trash2,
  ShieldCheck,
  Loader2,
  ShieldAlert,
  Megaphone,
  Bell,
  BellOff,
  Search,
  ChevronDown,
  MessageCircle,
  LifeBuoy,
  ScrollText,
  Download,
  Link as LinkIcon,
  Camera,
} from "lucide-react";

const CARD_W = 200;
const CARD_H = 60;
const SLOT0 = 86;
const ROUND_GAP = 92;

const MODE_LABEL = { "5x5": "5 НА 5", "2x2": "2 НА 2" };

// Фиксированные форматы турнира по числу команд — вместо свободного
// числового поля, чтобы сетка всегда собиралась ровно (степень
// двойки), без "лишних" команд и bye-проходов без соперника.
const TOURNAMENT_FORMATS = [
  { value: 8, label: "Турнир · 8 команд" },
  { value: 16, label: "Турнир · 16 команд" },
  { value: 4, label: "Матч · 4 команды" },
  { value: 2, label: "Матч · 2 команды" },
];
const TOURNAMENT_FORMAT_DESC = {
  8: "Четвертьфинал → полуфинал → финал",
  16: "1/8 финала → четвертьфинал → полуфинал → финал",
  4: "Полуфинал → финал",
  2: "Один матч сразу за победу",
};
const STATUS_LABEL = { registration: "Регистрация", bracket_ready: "Сетка готова", live: "Идёт турнир", finished: "Завершён" };
const MAP_POOL = ["dust2", "mirage", "nuke", "overpass", "train", "anubis", "inferno"];
const MAP_LABEL = {
  dust2: "Dust2",
  mirage: "Mirage",
  nuke: "Nuke",
  overpass: "Overpass",
  train: "Train",
  anubis: "Anubis",
  inferno: "Inferno",
};
const MAP_GRADIENT = {  dust2: "linear-gradient(150deg,#c9a227,#7a5a12 55%,#2b1f08)",
  mirage: "linear-gradient(150deg,#d99a4e,#8a5524 55%,#2c1a0b)",
  nuke: "linear-gradient(150deg,#8fa6b5,#3f5a6b 55%,#131f26)",
  overpass: "linear-gradient(150deg,#7fae7a,#39683d 55%,#122016)",
  train: "linear-gradient(150deg,#9aa3ad,#4b535c 55%,#171a1e)",
  anubis: "linear-gradient(150deg,#c98a3c,#7d4a1c 55%,#2a1608)",
  inferno: "linear-gradient(150deg,#c25a3a,#7d2f1c 55%,#2a0d08)",
};
const STATUS_COLOR = { registration: "#6B7280", live: "#D9414C", finished: "#5C5254" };
const RANK_STYLE = {
  0: { background: "linear-gradient(140deg,#E8A33D,#a06d1c)", color: "#1a1110" },
  1: { background: "linear-gradient(140deg,#c9c9c9,#7d7d7d)", color: "#1a1110" },
  2: { background: "linear-gradient(140deg,#c98a3c,#7d4a1c)", color: "#1a1110" },
};

function VetoBackground() {
  const farRef = useRef(null);
  const midRef = useRef(null);
  const nearRef = useRef(null);

  useEffect(() => {
    const layers = [
      { ref: farRef, depth: 40, scale: 1.0 },
      { ref: midRef, depth: 90, scale: 1.03 },
      { ref: nearRef, depth: 170, scale: 1.07 },
    ];
    const handleMove = (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2;
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;
      layers.forEach(({ ref, depth, scale }) => {
        if (ref.current) {
          ref.current.style.transform = `rotate(-6deg) translate(${(-cx * depth).toFixed(1)}px, ${(-cy * depth).toFixed(1)}px) scale(${scale})`;
        }
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const makeRows = (rows, reps) =>
    Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="nur-veto-bg-row">
        {Array.from({ length: reps }).map((_, i) => (
          <span key={i}>
            <span className="nur-veto-bg-nur">NUR</span>
            <span className="nur-veto-bg-tour">TOURNAMENTS</span>
          </span>
        ))}
      </div>
    ));

  return (
    <>
      <div ref={farRef} className="nur-veto-bg-layer nur-veto-bg-far">
        {makeRows(9, 8)}
      </div>
      <div ref={midRef} className="nur-veto-bg-layer nur-veto-bg-mid">
        {makeRows(6, 6)}
      </div>
      <div ref={nearRef} className="nur-veto-bg-layer nur-veto-bg-near">
        {makeRows(4, 5)}
      </div>
    </>
  );
}

function ModeToggle({ value, onChange, options }) {
  const rowRef = useRef(null);
  const opts = options || [
    { value: "5x5", label: MODE_LABEL["5x5"] },
    { value: "2x2", label: MODE_LABEL["2x2"] },
  ];

  const burst = (btnEl) => {
    const host = rowRef.current && rowRef.current.closest(".nur-mode-card");
    const field = host && host.querySelector(".nur-mode-smoke-field");
    if (!host || !field) return;
    const hostRect = host.getBoundingClientRect();
    const btnRect = btnEl.getBoundingClientRect();
    const originX = btnRect.left - hostRect.left + btnRect.width / 2;
    const originY = btnRect.top - hostRect.top + btnRect.height / 2;

    const colors = [
      "radial-gradient(circle, rgba(255,120,110,0.85), rgba(217,65,76,0.55) 45%, transparent 75%)",
      "radial-gradient(circle, rgba(255,196,110,0.85), rgba(232,163,61,0.5) 45%, transparent 75%)",
      "radial-gradient(circle, rgba(120,160,255,0.6), rgba(70,100,220,0.35) 45%, transparent 75%)",
      "radial-gradient(circle, rgba(255,150,90,0.8), rgba(200,60,60,0.45) 45%, transparent 75%)",
    ];

    const count = 16;
    for (let i = 0; i < count; i++) {
      const puff = document.createElement("div");
      puff.className = "nur-mode-puff2";
      const size = 60 + Math.random() * 100;
      const spreadX = (Math.random() - 0.5) * hostRect.width * 1.3;
      const spreadY = -30 - Math.random() * 90;
      const dur = 1.4 + Math.random() * 1.1;
      const delay = Math.random() * 0.35;
      puff.style.width = size + "px";
      puff.style.height = size + "px";
      puff.style.left = originX + "px";
      puff.style.top = originY + "px";
      puff.style.marginLeft = -(size / 2) + "px";
      puff.style.marginTop = -(size / 2) + "px";
      puff.style.background = colors[Math.floor(Math.random() * colors.length)];
      puff.style.setProperty("--x1", spreadX + "px");
      puff.style.setProperty("--y1", spreadY + "px");
      puff.style.setProperty("--s1", (1.6 + Math.random() * 1.2).toFixed(2));
      puff.style.setProperty("--peak", (0.6 + Math.random() * 0.3).toFixed(2));
      puff.style.setProperty("--dur", dur + "s");
      puff.style.setProperty("--delay", delay + "s");
      field.appendChild(puff);
      puff.addEventListener("animationend", () => puff.remove());
    }
  };

  const handleClick = (m, e) => {
    if (m !== value) onChange(m);
    burst(e.currentTarget);
  };

  return (
    <>
      <div ref={rowRef} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {opts.map((o) => (
          <button
            key={o.value}
            className={`nur-mode-btn${value === o.value ? " active" : ""}`}
            onClick={(e) => handleClick(o.value, e)}
            style={{ ...styles.modeBtn, ...(value === o.value ? styles.modeBtnActive : {}), flex: 1, minWidth: 120, textAlign: "center" }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="nur-mode-smoke-field" />
    </>
  );
}

// Ссылки, упоминания каналов/чатов и т.п. — запрещены в никнейме
const LINK_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /t\.me\//i,
  /telegram/i,
  /vk\.com/i,
  /discord/i,
  /instagram/i,
  /whatsapp/i,
  /\.(com|ru|net|org|io|gg|co|me|su)\b/i,
  /@/,
];

// Базовый список корней нецензурных слов — можно дополнять своими вариантами.
// Сравнение идёт по очищенной от небуквенных символов строке, без учёта регистра.
const PROFANITY_STEMS = [
  "хуй", "хуе", "хуё", "хер", "пизд", "ебат", "ебал", "ебан", "ебл", "въеб",
  "бляд", "блят", "сучар", "гандон", "мудак", "мудил", "пидор", "пидар", "залуп", "чмо",
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "nigger", "faggot",
];

function containsBlockedLink(text) {
  return LINK_PATTERNS.some((re) => re.test(text));
}

function containsProfanity(text) {
  const normalized = text.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
  return PROFANITY_STEMS.some((stem) => normalized.includes(stem));
}

// Название/тег команды: только английские буквы, цифры и немного
// пунктуации (пробел, дефис, подчёркивание, точка) — никаких русских
// (и вообще не-латинских) букв.
function containsNonLatin(text) {
  return /[^A-Za-z0-9 _.\-]/.test(text);
}

// Ловит заявления вида "я менеджер/владелец канала X", попытки выдать себя
// за администрацию сайта или чьего-то Telegram-канала.
const IMPERSONATION_PATTERNS = [
  /менеджер/i,
  /владел[ец|ица]/i,
  /создател[ья]/i,
  /founder/i,
  /\bowner\b/i,
  /\bmanager\b/i,
  /админ(истратор)?\s*(канала|группы|чата|сайта)/i,
  /(канала|группы|чата|сайта)\s*(nur|нур)/i,
];

function containsImpersonationClaim(text) {
  return IMPERSONATION_PATTERNS.some((re) => re.test(text));
}

function validateUsername(raw) {
  const name = raw.trim();
  if (name.length < 3) return "Никнейм — минимум 3 символа.";
  if (containsBlockedLink(name)) return "Никнейм не может содержать ссылки или упоминания каналов/сайтов.";
  if (containsProfanity(name)) return "Никнейм содержит недопустимые слова. Выберите другой.";
  return null;
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function roundLabel(totalRounds, r) {
  const remaining = totalRounds - r;
  if (remaining === 1) return "ФИНАЛ";
  if (remaining === 2) return "ПОЛУФИНАЛ";
  if (remaining === 3) return "ЧЕТВЕРТЬФИНАЛ";
  return `РАУНД ${r + 1}`;
}

// Двухстрочная подпись раунда как в дизайне: английское название сверху
// капсом, ниже — нотация вида "[1/8 ФИНАЛА]".
function roundLabelEN(totalRounds, r) {
  const remaining = totalRounds - r;
  if (remaining === 1) return "FINAL";
  if (remaining === 2) return "SEMIFINALS";
  if (remaining === 3) return "QUARTERFINALS";
  if (remaining === 4) return "ROUND OF 16";
  if (remaining === 5) return "ROUND OF 32";
  return `ROUND ${r + 1}`;
}
function roundLabelSub(totalRounds, r) {
  const remaining = totalRounds - r;
  if (remaining === 1) return "[ФИНАЛ]";
  if (remaining === 2) return "[ПОЛУФИНАЛ]";
  if (remaining === 3) return "[1/4 ФИНАЛА]";
  if (remaining === 4) return "[1/8 ФИНАЛА]";
  if (remaining === 5) return "[1/16 ФИНАЛА]";
  return `[РАУНД ${r + 1}]`;
}

function computeGeometry(rounds) {
  const m0 = rounds[0].length;
  const containerHeight = m0 * SLOT0;
  const centerY = (r, i) => {
    const slot = SLOT0 * Math.pow(2, r);
    return i * slot + slot / 2;
  };
  const connectors = [];
  for (let r = 1; r < rounds.length; r++) {
    rounds[r].forEach((m, j) => {
      const y1 = centerY(r - 1, j * 2);
      const y2 = centerY(r - 1, j * 2 + 1);
      const yMid = centerY(r, j);
      const xLeft = r * (CARD_W + ROUND_GAP) - ROUND_GAP;
      const xMid = xLeft + ROUND_GAP / 2;
      connectors.push({ key: `${r}-${j}`, xLeft, xMid, y1, y2, yMid });
    });
  }
  return { containerHeight, centerY, connectors, width: rounds.length * (CARD_W + ROUND_GAP) };
}

function teamLabel(team) {
  if (!team) return null;
  return team.tag ? `[${team.tag}] ${team.name}` : team.name;
}

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${day} в ${time}`;
}

function FileChooser({ id, accept = "image/*", onChange, disabled, uploadingLabel, label = "Выбрать файл" }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const handleChange = (e) => {
    const f = e.target.files?.[0];
    setFileName(f ? f.name : "");
    onChange?.(e);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <input ref={inputRef} id={id} type="file" accept={accept} disabled={disabled} onChange={handleChange} style={{ display: "none" }} />
      <button
        type="button"
        className="nur-btn"
        style={{ ...styles.ghostBtnSm, opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer" }}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {disabled && uploadingLabel ? uploadingLabel : label}
      </button>
      <span style={{ ...styles.hint, fontSize: 11.5 }}>{fileName || "Файл не выбран"}</span>
    </div>
  );
}

// Компактный вариант загрузки файла — маленькая круглая иконка-кнопка
// поверх аватара/баннера (клик открывает системный выбор файла), вместо
// отдельной строки "Выбрать файл" + текст с именем файла. Используется в
// переработанной карточке профиля.
function IconFileChooser({ icon, disabled, onChange, style, title }) {
  const inputRef = useRef(null);
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" disabled={disabled} onChange={onChange} style={{ display: "none" }} />
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{
          border: "none",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        {icon}
      </button>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [rulesChecked, setRulesChecked] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState("tournaments");
  const [createTeamMode, setCreateTeamMode] = useState("5x5");
  const [leaderboardMode, setLeaderboardMode] = useState("5x5");

  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [ads, setAds] = useState([]);
  const [adUploading, setAdUploading] = useState({});
  const [adLinkDrafts, setAdLinkDrafts] = useState({});
  const [adExpiryDrafts, setAdExpiryDrafts] = useState({});
  const [mapImages, setMapImages] = useState({});
  const [banningMapKey, setBanningMapKey] = useState(null);
  const [matchLobbies, setMatchLobbies] = useState([]);
  const [allBracketMatches, setAllBracketMatches] = useState([]);
  const [matchFilter, setMatchFilter] = useState("all");
  const [nowTs, setNowTs] = useState(() => Date.now());

  // Тикающие часы для обратного отсчёта в шапке главной.
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [dismissedLobbyIds, setDismissedLobbyIds] = useState(() => new Set());
  const [dismissedVetoIds, setDismissedVetoIds] = useState(() => new Set());
  const [mapImageUploading, setMapImageUploading] = useState({});

  const [authScreen, setAuthScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [newTeamLogoFile, setNewTeamLogoFile] = useState(null);
  const [newTeamLogoPreview, setNewTeamLogoPreview] = useState("");
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState(null);
  const [addMemberQuery, setAddMemberQuery] = useState({});
  const [addMemberResults, setAddMemberResults] = useState({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [friends, setFriends] = useState([]);
  const friendsRef = useRef([]);
  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);
  const mutedUserIdsRef = useRef(new Set());
  const [teamInvites, setTeamInvites] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentPendingIds, setSentPendingIds] = useState([]);
  const [sentPendingRequests, setSentPendingRequests] = useState([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const navPanelRef = useRef(null);
  const avatarPillRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const navAreaRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (navAreaRef.current && !navAreaRef.current.contains(e.target)) {
        setNavMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const [viewingUser, setViewingUser] = useState(null);
  const [viewingUserFriends, setViewingUserFriends] = useState([]);
  const [viewingUserFriendsLoading, setViewingUserFriendsLoading] = useState(false);
  const [viewingProfileTab, setViewingProfileTab] = useState("activity");
  const [expandedRosterTeamId, setExpandedRosterTeamId] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [typeSoundOn, setTypeSoundOn] = useState(() => {
    try {
      return localStorage.getItem("nur-type-sound") !== "off";
    } catch {
      return true;
    }
  });
  const [soundPresetId, setSoundPresetId] = useState(() => {
    try {
      return localStorage.getItem("nur-type-sound-preset") || "keyboard-click";
    } catch {
      return "soft-click";
    }
  });
  const [soundVolume, setSoundVolume] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem("nur-type-sound-volume"));
      return Number.isFinite(v) ? v : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [skipBackspaceSound, setSkipBackspaceSound] = useState(() => {
    try {
      return localStorage.getItem("nur-skip-backspace-sound") === "on";
    } catch {
      return false;
    }
  });
  const [skipSpaceSound, setSkipSpaceSound] = useState(() => {
    try {
      return localStorage.getItem("nur-skip-space-sound") === "on";
    } catch {
      return false;
    }
  });
  const SOUND_PRESETS = [
    { id: "keyboard-click", name: "Клавиатура", src: sndKeyboardClick },
    { id: "modern-click", name: "Современный клик", src: sndModernClick },
    { id: "hard-typewriter", name: "Машинка (жёсткий)", src: sndHardTypewriter },
    { id: "soft-typewriter", name: "Машинка (мягкий)", src: sndSoftTypewriter },
    { id: "bubble-click", name: "Пузырёк", src: sndBubbleClick },
    { id: "mouse-click", name: "Клик мышкой", src: sndMouseClick },
  ];

  const playPresetSound = (presetId) => {
    const preset = SOUND_PRESETS.find((p) => p.id === presetId) || SOUND_PRESETS[0];
    try {
      const audio = new Audio(preset.src);
      audio.volume = soundVolume;
      audio.play().catch(() => {});
    } catch {
      /* ignore audio errors */
    }
  };

  const playTypeSound = (e) => {
    if (!typeSoundOn) return;
    const key = e?.key;
    if (skipBackspaceSound && (key === "Backspace" || key === "Delete")) return;
    if (skipSpaceSound && key === " ") return;
    playPresetSound(soundPresetId);
  };

  const selectSoundPreset = (presetId) => {
    setSoundPresetId(presetId);
    try {
      localStorage.setItem("nur-type-sound-preset", presetId);
    } catch {
      /* ignore storage errors */
    }
    playPresetSound(presetId);
  };

  const changeSoundVolume = (val) => {
    setSoundVolume(val);
    try {
      localStorage.setItem("nur-type-sound-volume", String(val));
    } catch {
      /* ignore storage errors */
    }
  };

  const toggleSkipBackspaceSound = () => {
    setSkipBackspaceSound((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nur-skip-backspace-sound", next ? "on" : "off");
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const toggleSkipSpaceSound = () => {
    setSkipSpaceSound((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nur-skip-space-sound", next ? "on" : "off");
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const toggleTypeSound = () => {
    setTypeSoundOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nur-type-sound", next ? "on" : "off");
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };
  const [bioSaving, setBioSaving] = useState(false);
  const [soundsCardOpen, setSoundsCardOpen] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const chatMessagesRef = useRef(null);
  useEffect(() => {
    if (chatMessagesRef.current) chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
  }, [chatMessages]);
  const [chatInput, setChatInput] = useState("");
  const [chatSendTimes, setChatSendTimes] = useState([]);
  const [supportSendTimes, setSupportSendTimes] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [toasts, setToasts] = useState([]);
  const [readyChecks, setReadyChecks] = useState([]);
  const [readyCheckNow, setReadyCheckNow] = useState(Date.now());
  const [matchVetoes, setMatchVetoes] = useState([]);

  const showToast = (text, sender) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, sender }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // Уведомления браузера (Web Notifications API) — всплывают системным
  // попапом, только когда вкладка сайта СЕЙЧАС НЕ в фокусе (если она и
  // так открыта, тоста в углу достаточно, дублировать незачем).
  // Разрешение запрашивается один раз, в момент первого реального
  // события, а не сразу при заходе на сайт (не хотим навязчивый запрос
  // прямо с порога).
  const requestedNotifPermissionRef = useRef(false);
  const sendBrowserNotification = (title, body) => {
    if (typeof Notification === "undefined") return;
    if (!document.hidden) return;
    const fire = () => {
      try {
        new Notification(title, { body, icon: "/favicon-32.png" });
      } catch (_) {
        // уведомления не поддерживаются/заблокированы — просто без них
      }
    };
    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission !== "denied" && !requestedNotifPermissionRef.current) {
      requestedNotifPermissionRef.current = true;
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") fire();
      });
    }
  };

  // Звук нового сообщения/заявки в друзья — играет независимо от того,
  // в фокусе вкладка или нет (в отличие от системного уведомления выше,
  // которое показывается только когда вкладка НЕ в фокусе).
  const playNotifSound = () => {
    try {
      const audio = new Audio(sndNotification);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (_) {
      // звук не проигрался — не критично
    }
  };
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [mutedUserIds, setMutedUserIds] = useState(new Set());
  const [lfgPosts, setLfgPosts] = useState([]);
  const [lfgFilter, setLfgFilter] = useState("all");
  const [showCreateLfg, setShowCreateLfg] = useState(false);
  const [newLfgKind, setNewLfgKind] = useState("need_player");
  const [newLfgMode, setNewLfgMode] = useState("5x5");
  const [newLfgTeamId, setNewLfgTeamId] = useState("");
  const [newLfgDesc, setNewLfgDesc] = useState("");
  useEffect(() => {
    mutedUserIdsRef.current = mutedUserIds;
  }, [mutedUserIds]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [supportPanelOpen, setSupportPanelOpen] = useState(false);
  const [supportTarget, setSupportTarget] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const supportMessagesRef = useRef(null);
  useEffect(() => {
    if (supportMessagesRef.current) supportMessagesRef.current.scrollTop = supportMessagesRef.current.scrollHeight;
  }, [supportMessages]);
  const [supportInput, setSupportInput] = useState("");
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportArchive, setSupportArchive] = useState([]);
  const [supportTicketId, setSupportTicketId] = useState(null);
  const [supportTicketStatus, setSupportTicketStatus] = useState(null);
  const [supportPageTab, setSupportPageTab] = useState("active");
  const [confirmCloseTicket, setConfirmCloseTicket] = useState(false);
  const [confirmDeleteTicketId, setConfirmDeleteTicketId] = useState(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const [supportView, setSupportView] = useState("chat");
  const supportTargetRef = useRef(null);
  useEffect(() => {
    supportTargetRef.current = supportTarget;
  }, [supportTarget]);
  const supportTicketIdRef = useRef(null);
  useEffect(() => {
    supportTicketIdRef.current = supportTicketId;
  }, [supportTicketId]);
  const supportTicketStatusRef = useRef(null);
  useEffect(() => {
    supportTicketStatusRef.current = supportTicketStatus;
  }, [supportTicketStatus]);
  const activeChatFriendRef = useRef(null);
  useEffect(() => {
    activeChatFriendRef.current = activeChatFriend;
  }, [activeChatFriend]);
  const profileRef = useRef(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const supportPanelOpenRef = useRef(false);
  useEffect(() => {
    supportPanelOpenRef.current = supportPanelOpen;
  }, [supportPanelOpen]);
  const supportViewRef = useRef("chat");
  useEffect(() => {
    supportViewRef.current = supportView;
  }, [supportView]);

  const [chatDrag, setChatDrag] = useState({ x: 0, y: 0 });
  const chatDragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onChatDragMove = (e) => {
    if (!chatDragState.current.dragging) return;
    const dx = e.clientX - chatDragState.current.startX;
    const dy = e.clientY - chatDragState.current.startY;
    setChatDrag({ x: chatDragState.current.origX + dx, y: chatDragState.current.origY + dy });
  };

  const onChatDragUp = () => {
    chatDragState.current.dragging = false;
    window.removeEventListener("mousemove", onChatDragMove);
    window.removeEventListener("mouseup", onChatDragUp);
  };

  const onChatHeaderMouseDown = (e) => {
    chatDragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: chatDrag.x,
      origY: chatDrag.y,
    };
    window.addEventListener("mousemove", onChatDragMove);
    window.addEventListener("mouseup", onChatDragUp);
  };

  const [supportDrag, setSupportDrag] = useState({ x: 0, y: 0 });
  const supportDragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onSupportDragMove = (e) => {
    if (!supportDragState.current.dragging) return;
    const dx = e.clientX - supportDragState.current.startX;
    const dy = e.clientY - supportDragState.current.startY;
    setSupportDrag({ x: supportDragState.current.origX + dx, y: supportDragState.current.origY + dy });
  };

  const onSupportDragUp = () => {
    supportDragState.current.dragging = false;
    window.removeEventListener("mousemove", onSupportDragMove);
    window.removeEventListener("mouseup", onSupportDragUp);
  };

  const onSupportHeaderMouseDown = (e) => {
    supportDragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: supportDrag.x,
      origY: supportDrag.y,
    };
    window.addEventListener("mousemove", onSupportDragMove);
    window.addEventListener("mouseup", onSupportDragUp);
  };

  const [newTourName, setNewTourName] = useState("");
  const [newTourMode, setNewTourMode] = useState("5x5");
  const [newTourPrize, setNewTourPrize] = useState("");
  const [newTourMaxTeams, setNewTourMaxTeams] = useState(8);
  const [newTourBannerFile, setNewTourBannerFile] = useState(null);
  const [newTourAnnounceAt, setNewTourAnnounceAt] = useState("");
  const [newTourRegOpenAt, setNewTourRegOpenAt] = useState("");
  const [newTourStartAt, setNewTourStartAt] = useState("");
  const [tourCreating, setTourCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [regSelections, setRegSelections] = useState({});

  const [expandedTour, setExpandedTour] = useState(null);
  const [showTeamsTour, setShowTeamsTour] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [expandedRounds, setExpandedRounds] = useState(null);
  const bracketCaptureRef = useRef(null);

  useEffect(() => {
    setExpandedTour(null);
    setExpandedRounds(null);
  }, [activeTab]);

  const refreshTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, mode, name, tag, owner_id, max_size, logo_url, team_members(member_name)")
      .order("created_at");
    if (error) return setErrorMsg(error.message);
    setTeams(data || []);
  }, []);

  const refreshTournaments = useCallback(async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select(
        "id, mode, name, status, banner_url, prize_pool, max_teams, announce_at, reg_open_at, start_at, created_at, tournament_teams(team_id)"
      )
      .order("created_at");
    if (error) return setErrorMsg(error.message);
    setTournaments(data || []);
  }, []);

  const refreshAllMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("id, tournament_id, round, winner_id, team1_id, team2_id, team1_score, team2_score")
      .not("winner_id", "is", null);
    if (error) return setErrorMsg(error.message);
    setAllMatches(data || []);
  }, []);

  // Полная сетка ВСЕХ матчей (включая ещё не сыгранные) — нужна для
  // мини-сетки и «живой ленты» на главной. allMatches намеренно не трогаем:
  // он грузит только завершённые матчи и на нём завязаны лидерборд и история.
  const refreshAllBracketMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("id, tournament_id, round, match_index, team1_id, team2_id, winner_id, team1_score, team2_score")
      .order("round")
      .order("match_index");
    if (error) return;
    setAllBracketMatches(data || []);
  }, []);

  const refreshReadyChecks = useCallback(async () => {
    const { data, error } = await supabase.from("match_ready_checks").select("*").eq("status", "pending");
    if (error) return;
    setReadyChecks(data || []);
  }, []);

  const refreshMatchVetoes = useCallback(async () => {
    const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("match_vetoes")
      .select("*")
      .or(`status.eq.in_progress,and(status.eq.completed,created_at.gte.${recentCutoff})`);
    if (error) return;
    setMatchVetoes(data || []);
  }, []);

  const refreshMatchLobbies = useCallback(async () => {
    const recentCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("match_lobbies").select("*").gte("created_at", recentCutoff);
    if (error) return;
    setMatchLobbies(data || []);
  }, []);

  const refreshMapImages = useCallback(async () => {
    const { data, error } = await supabase.from("map_images").select("map_key, image_url");
    if (error) return;
    const map = {};
    (data || []).forEach((row) => {
      if (row.image_url) map[row.map_key] = row.image_url;
    });
    setMapImages(map);
  }, []);

  const refreshStaffProfiles = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("id, username, avatar_url").or("is_admin.eq.true,is_moderator.eq.true");
    if (error) return;
    setStaffProfiles(data || []);
  }, []);

  const refreshSupportTickets = useCallback(async () => {
    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) return;
    if (!tickets || !tickets.length) return setSupportTickets([]);
    const ticketIds = tickets.map((t) => t.id);
    const userIds = [...new Set(tickets.map((t) => t.user_id))];
    const [{ data: profs }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("id, username, avatar_url").in("id", userIds),
      supabase.from("support_messages").select("ticket_id, created_at").in("ticket_id", ticketIds).order("created_at", { ascending: false }),
    ]);
    const lastByTicket = new Map();
    (msgs || []).forEach((m) => {
      if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m.created_at);
    });
    const list = tickets
      .map((t) => {
        const p = (profs || []).find((pr) => pr.id === t.user_id);
        return p
          ? { ticket_id: t.id, user_id: t.user_id, username: p.username, avatar_url: p.avatar_url, last_at: lastByTicket.get(t.id) || t.created_at }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
    setSupportTickets(list);
  }, []);

  const refreshSupportArchive = useCallback(async () => {
    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, closed_at")
      .eq("status", "closed")
      .order("closed_at", { ascending: false });
    if (error) return;
    if (!tickets || !tickets.length) return setSupportArchive([]);
    const userIds = [...new Set(tickets.map((t) => t.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds);
    const list = tickets.map((t) => {
      const p = (profs || []).find((pr) => pr.id === t.user_id);
      return { ticket_id: t.id, user_id: t.user_id, username: p?.username || "?", avatar_url: p?.avatar_url, closed_at: t.closed_at };
    });
    setSupportArchive(list);
  }, []);

  const refreshAds = useCallback(async () => {
    const { data, error } = await supabase.from("showcase").select("id, slot, image_url, link_url, is_active, expires_at").order("slot");
    if (error) return;
    setAds(data || []);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("nur-showcase-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "showcase" }, () => refreshAds())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => refreshTournaments())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_teams" }, () => refreshTournaments())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => refreshTeams())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => { refreshAllMatches(); refreshAllBracketMatches(); })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAds, refreshTournaments, refreshTeams, refreshAllMatches, refreshAllBracketMatches]);

  const refreshFriends = useCallback(async (userId) => {
    if (!userId) {
      setFriends([]);
      setIncomingRequests([]);
      setSentPendingIds([]);
      return;
    }
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        "id, status, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, username, avatar_url, banner_url, bio), receiver:profiles!friend_requests_receiver_id_fkey(id, username, avatar_url, banner_url, bio)"
      )
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (error) return;
    const rows = data || [];
    const accepted = rows
      .filter((r) => r.status === "accepted")
      .map((r) => ({ requestId: r.id, ...(r.sender_id === userId ? r.receiver : r.sender) }));
    const incoming = rows.filter((r) => r.status === "pending" && r.receiver_id === userId).map((r) => ({ requestId: r.id, ...r.sender }));
    const sentPending = rows
      .filter((r) => r.status === "pending" && r.sender_id === userId)
      .map((r) => ({ requestId: r.id, ...r.receiver }));
    setFriends(accepted);
    setIncomingRequests(incoming);
    setSentPendingRequests(sentPending);
    setSentPendingIds(sentPending.map((r) => r.id));
  }, []);

  const refreshLfgPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("teammate_posts")
      .select("id, author_id, kind, mode, team_id, description, created_at, author:profiles!teammate_posts_author_id_fkey(id, username, avatar_url)")
      .order("created_at", { ascending: false });
    if (error) return;
    setLfgPosts(data || []);
  }, []);

  const createLfgPost = async () => {
    if (!session) return;
    const desc = newLfgDesc.trim();
    if (containsBlockedLink(desc) || containsProfanity(desc)) {
      return setErrorMsg("В описании нельзя размещать ссылки, упоминания каналов и нецензурную лексику.");
    }
    if (newLfgKind === "need_player" && !newLfgTeamId) {
      return setErrorMsg("Выберите команду, в которую ищете игрока.");
    }
    const { error } = await supabase.from("teammate_posts").insert({
      author_id: session.user.id,
      kind: newLfgKind,
      mode: newLfgMode,
      team_id: newLfgKind === "need_player" ? newLfgTeamId : null,
      description: desc.slice(0, 300),
    });
    if (error) return setErrorMsg(error.message);
    setShowCreateLfg(false);
    setNewLfgDesc("");
    setNewLfgTeamId("");
    refreshLfgPosts();
  };

  const deleteLfgPost = async (postId) => {
    const { error } = await supabase.from("teammate_posts").delete().eq("id", postId);
    if (error) return setErrorMsg(error.message);
    refreshLfgPosts();
  };

  const refreshMutedUsers = useCallback(async (userId) => {
    if (!userId) return setMutedUserIds(new Set());
    const { data, error } = await supabase.from("muted_users").select("muted_id").eq("muter_id", userId);
    if (error) return;
    setMutedUserIds(new Set((data || []).map((r) => r.muted_id)));
  }, []);

  // Мут — сообщения от этого человека перестают давать уведомления
  // (тост, счётчик непрочитанных), сама переписка при этом никуда не
  // девается и видна как обычно, если открыть чат самостоятельно.
  const muteUser = async (userId) => {
    if (!session) return;
    const { error } = await supabase.from("muted_users").insert({ muter_id: session.user.id, muted_id: userId });
    if (error) return setErrorMsg(error.message);
    setMutedUserIds((prev) => new Set(prev).add(userId));
  };
  const unmuteUser = async (userId) => {
    if (!session) return;
    const { error } = await supabase.from("muted_users").delete().eq("muter_id", session.user.id).eq("muted_id", userId);
    if (error) return setErrorMsg(error.message);
    setMutedUserIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const refreshTeamInvites = useCallback(async (userId) => {
    if (!userId) {
      setTeamInvites([]);
      return;
    }
    const { data, error } = await supabase
      .from("team_invites")
      .select("id, status, team:teams!team_invites_team_id_fkey(id, name, tag, mode)")
      .eq("invited_id", userId)
      .eq("status", "pending");
    if (error) return;
    setTeamInvites(data || []);
  }, []);

  useEffect(() => {
    if (!session) {
      setChatMessages([]);
      setActiveChatFriend(null);
      setUnreadCounts({});
      return;
    }
    const channel = supabase
      .channel(`nur-realtime-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `receiver_id=eq.${session.user.id}` },
        async (payload) => {
          refreshFriends(session.user.id);
          if (payload.eventType === "INSERT" && payload.new.status === "pending") {
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("id", payload.new.sender_id)
              .single();
            const uname = senderProfile?.username || "Игрок";
            showToast(`Заявка в друзья от ${uname}`, senderProfile);
            sendBrowserNotification("Новая заявка в друзья", `${uname} хочет добавить вас в друзья`);
            playNotifSound();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `sender_id=eq.${session.user.id}` },
        () => refreshFriends(session.user.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_invites", filter: `invited_id=eq.${session.user.id}` },
        () => refreshTeamInvites(session.user.id)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${session.user.id}` },
        (payload) => {
          const msg = payload.new;
          const isMuted = mutedUserIdsRef.current.has(msg.sender_id);
          if (activeChatFriendRef.current && activeChatFriendRef.current.id === msg.sender_id) {
            setChatMessages((prev) => [...prev, msg]);
          } else if (!isMuted) {
            setUnreadCounts((prev) => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
            const sender = friendsRef.current.find((f) => f.id === msg.sender_id);
            const uname = sender?.username || "друга";
            showToast(`Новое сообщение от ${uname}`, sender);
            sendBrowserNotification(`Сообщение от ${uname}`, msg.content?.slice(0, 120) || "");
            playNotifSound();
          }
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const msg = payload.new;
        if (msg.sender_id === session.user.id) return;
        const isStaff = profileRef.current?.is_admin || profileRef.current?.is_moderator;
        const viewingThisTicket = supportTicketStatusRef.current === "open" && supportTicketIdRef.current && msg.ticket_id === supportTicketIdRef.current;
        if (viewingThisTicket) {
          setSupportMessages((prev) => [...prev, msg]);
        } else if (!isStaff && msg.user_id === session.user.id) {
          setSupportUnread((prev) => prev + 1);
        } else if (isStaff) {
          setSupportUnread((prev) => prev + 1);
        }
        if (isStaff) refreshSupportTickets();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets" }, (payload) => {
        const ticket = payload.new;
        const isStaff = profileRef.current?.is_admin || profileRef.current?.is_moderator;
        if (ticket.status === "closed" && supportTicketIdRef.current === ticket.id) {
          setSupportMessages([]);
          setSupportTarget(null);
          setSupportTicketId(null);
          setSupportTicketStatus(null);
          setConfirmCloseTicket(false);
        }
        if (isStaff) {
          refreshSupportTickets();
          refreshSupportArchive();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_ready_checks" }, () => {
        refreshReadyChecks();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_vetoes" }, () => {
        refreshMatchVetoes();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_lobbies" }, () => {
        refreshMatchLobbies();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "map_images" }, () => {
        refreshMapImages();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, refreshFriends, refreshTeamInvites, refreshSupportTickets, refreshSupportArchive, refreshReadyChecks, refreshMatchVetoes, refreshMatchLobbies, refreshMapImages]);

  useEffect(() => {
    if (!session) {
      setOnlineUserIds(new Set());
      return;
    }
    const presenceChannel = supabase.channel("nur-online-users", {
      config: { presence: { key: session.user.id } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUserIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [session]);

  const openChat = async (friend) => {
    setActiveChatFriend(friend);
    setUnreadCounts((prev) => ({ ...prev, [friend.id]: 0 }));
    setNavMenuOpen(false);
    setNotifOpen(false);
    setChatDrag({ x: 0, y: 0 });
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at")
      .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${session.user.id})`)
      .order("created_at");
    if (error) return setErrorMsg(error.message);
    setChatMessages(data || []);
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || !activeChatFriend || !session) return;
    const now = Date.now();
    const recent = chatSendTimes.filter((t) => now - t < 10000);
    if (recent.length >= 3) {
      const waitSec = Math.ceil((10000 - (now - recent[0])) / 1000);
      return setErrorMsg(`Не так быстро — подождите ещё ${waitSec} сек.`);
    }
    setChatInput("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: session.user.id, receiver_id: activeChatFriend.id, content: text })
      .select()
      .single();
    if (error) {
      setChatInput(text);
      return setErrorMsg(error.message);
    }
    setChatSendTimes([...recent, now]);
    setChatMessages((prev) => [...prev, data]);
  };


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    refreshTeams();
    refreshTournaments();
    refreshAllMatches();
    refreshAllBracketMatches();
    refreshReadyChecks();
    refreshMatchVetoes();
    refreshMatchLobbies();
    refreshMapImages();
    refreshAds();
    refreshStaffProfiles();
    refreshLfgPosts();
    return () => sub.subscription.unsubscribe();
  }, [
    refreshTeams,
    refreshTournaments,
    refreshAllMatches,
    refreshAllBracketMatches,
    refreshReadyChecks,
    refreshMatchVetoes,
    refreshMatchLobbies,
    refreshMapImages,
    refreshAds,
    refreshStaffProfiles,
    refreshLfgPosts,
  ]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setFriends([]);
      return;
    }
    supabase
      .from("profiles")
      .select("username, is_admin, is_moderator, avatar_url, banner_url, bio, is_closed, agreed_rules_at")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) return setErrorMsg(error.message);
        setProfile(data);
        setBioDraft(data?.bio || "");
        if (data?.is_admin || data?.is_moderator) {
          refreshSupportTickets();
          refreshSupportArchive();
        }
      });
    refreshFriends(session.user.id);
    refreshMutedUsers(session.user.id);
    refreshTeamInvites(session.user.id);
  }, [session, refreshFriends, refreshMutedUsers, refreshTeamInvites, refreshSupportTickets, refreshSupportArchive]);

  const doRegister = async () => {
    setErrorMsg("");
    const usernameError = validateUsername(username);
    if (usernameError) return setErrorMsg(usernameError);
    if (password.length < 6) return setErrorMsg("Пароль — минимум 6 символов.");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) return setErrorMsg(error.message);
    if (!data.session) {
      setErrorMsg(
        "Проверьте почту для подтверждения регистрации (или отключите 'Confirm email' в настройках Supabase Auth для теста)."
      );
    }
  };

  const doLogin = async () => {
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErrorMsg(error.message);
  };

  const doLogout = async () => {
    await supabase.auth.signOut();
    setActiveTab("tournaments");
  };

  const uploadAvatar = async (file) => {
    if (!session || !file) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${session.user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setAvatarUploading(false);
      return setErrorMsg("Не удалось загрузить аватар: " + upErr.message);
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", session.user.id);
    setAvatarUploading(false);
    if (error) return setErrorMsg(error.message);
    setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
  };

  const uploadBanner = async (file) => {
    if (!session || !file) return;
    setBannerUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${session.user.id}/cover.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setBannerUploading(false);
      return setErrorMsg("Не удалось загрузить баннер: " + upErr.message);
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const bannerUrl = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ banner_url: bannerUrl }).eq("id", session.user.id);
    setBannerUploading(false);
    if (error) return setErrorMsg(error.message);
    setProfile((prev) => ({ ...prev, banner_url: bannerUrl }));
  };

  const fetchUserFriends = async (userId) => {
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        "sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, username, avatar_url, banner_url, bio), receiver:profiles!friend_requests_receiver_id_fkey(id, username, avatar_url, banner_url, bio)"
      )
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (error) return [];
    return (data || []).map((r) => (r.sender_id === userId ? r.receiver : r.sender));
  };

  const saveBio = async () => {
    if (!session) return;
    const text = bioDraft.trim();
    if (containsBlockedLink(text)) {
      return setErrorMsg("В описании нельзя оставлять ссылки или упоминания каналов/сайтов.");
    }
    if (containsProfanity(text)) {
      return setErrorMsg("Описание содержит недопустимые слова.");
    }
    if (containsImpersonationClaim(text)) {
      return setErrorMsg("В описании нельзя заявлять о владении/администрировании каналом, группой или сайтом.");
    }
    setBioSaving(true);
    const { error } = await supabase.from("profiles").update({ bio: text }).eq("id", session.user.id);
    setBioSaving(false);
    if (error) return setErrorMsg(error.message);
    setProfile((prev) => ({ ...prev, bio: text }));
  };

  const openUserProfile = async (user) => {
    if (!user) return;
    setViewingUser(user);
    setViewingUserFriendsLoading(true);
    setViewingProfileTab("activity");
    setExpandedRosterTeamId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const { data: fullProfile } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, banner_url, bio, is_moderator, is_closed")
      .eq("id", user.id)
      .single();
    if (fullProfile) setViewingUser(fullProfile);
    const list = await fetchUserFriends(user.id);
    setViewingUserFriends(list);
    setViewingUserFriendsLoading(false);
  };

  // Клик по игроку в составе команды (там известен только username, не id) —
  // находим его профиль по имени и открываем как обычно.
  const openTeamMemberProfile = async (username) => {
    const { data, error } = await supabase.from("profiles").select("id").eq("username", username).single();
    if (error || !data) return setErrorMsg("Профиль этого игрока не найден.");
    openUserProfile(data);
  };

  const toggleModerator = async (targetUser) => {
    const { error } = await supabase.from("profiles").update({ is_moderator: !targetUser.is_moderator }).eq("id", targetUser.id);
    if (error) return setErrorMsg(error.message);
    setViewingUser((prev) => (prev ? { ...prev, is_moderator: !targetUser.is_moderator } : prev));
  };

  const toggleClosedProfile = async (targetUser) => {
    const nextVal = !targetUser.is_closed;
    const { error } = await supabase.from("profiles").update({ is_closed: nextVal }).eq("id", targetUser.id);
    if (error) return setErrorMsg(error.message);
    if (session && targetUser.id === session.user.id) setProfile((prev) => (prev ? { ...prev, is_closed: nextVal } : prev));
    setViewingUser((prev) => (prev ? { ...prev, is_closed: nextVal } : prev));
  };


  const openSupportList = async () => {
    setSupportTarget(null);
    setSupportTicketId(null);
    setSupportTicketStatus(null);
    setConfirmCloseTicket(false);
    setSupportView("list");
    setSupportPanelOpen(true);
    setSupportDrag({ x: 0, y: 0 });
    setSupportUnread(0);
    refreshSupportTickets();
  };

  const ensureOpenTicket = async (userId) => {
    const { data: existing, error: selErr } = await supabase
      .from("support_tickets")
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return existing.id;
    const { data: created, error: insErr } = await supabase.from("support_tickets").insert({ user_id: userId }).select("id").single();
    if (insErr) throw insErr;
    return created.id;
  };

  const openSupportChat = async (target) => {
    if (!supportPanelOpen) setSupportDrag({ x: 0, y: 0 });
    const targetUserId = target ? target.user_id || target.id : session.user.id;
    setSupportTarget(target ? { id: targetUserId, username: target.username } : null);
    setSupportView("chat");
    setSupportPanelOpen(true);
    setSupportUnread(0);
    setConfirmCloseTicket(false);
    try {
      const ticketId = target && target.ticket_id ? target.ticket_id : await ensureOpenTicket(targetUserId);
      setSupportTicketId(ticketId);
      setSupportTicketStatus("open");
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, user_id, sender_id, content, created_at, ticket_id")
        .eq("ticket_id", ticketId)
        .order("created_at");
      if (error) return setErrorMsg(error.message);
      setSupportMessages(data || []);
    } catch (e) {
      setErrorMsg(e.message || "Не удалось открыть чат поддержки.");
    }
  };

  const openArchiveChat = async (ticket) => {
    setSupportTarget({ id: ticket.user_id, username: ticket.username });
    setSupportTicketId(ticket.ticket_id);
    setSupportTicketStatus("closed");
    setConfirmCloseTicket(false);
    const { data, error } = await supabase
      .from("support_messages")
      .select("id, user_id, sender_id, content, created_at, ticket_id")
      .eq("ticket_id", ticket.ticket_id)
      .order("created_at");
    if (error) return setErrorMsg(error.message);
    setSupportMessages(data || []);
  };

  const closeSupportTicket = async () => {
    if (!session || !supportTicketId || supportTicketStatus !== "open") return;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: session.user.id })
      .eq("id", supportTicketId);
    if (error) return setErrorMsg(error.message);
    setSupportMessages([]);
    setSupportTarget(null);
    setSupportTicketId(null);
    setSupportTicketStatus(null);
    setConfirmCloseTicket(false);
    if (profile?.is_admin || profile?.is_moderator) {
      refreshSupportTickets();
      refreshSupportArchive();
    }
  };

  const deleteArchivedTicket = async (ticketId) => {
    if (!profile?.is_admin) return;
    const { error } = await supabase.from("support_tickets").delete().eq("id", ticketId);
    if (error) return setErrorMsg(error.message);
    setConfirmDeleteTicketId(null);
    setSupportArchive((prev) => prev.filter((t) => t.ticket_id !== ticketId));
    if (supportTicketId === ticketId) {
      setSupportMessages([]);
      setSupportTarget(null);
      setSupportTicketId(null);
      setSupportTicketStatus(null);
    }
  };

  const sendSupportMessage = async () => {
    const text = supportInput.trim();
    if (!text || !session || !supportTicketId || supportTicketStatus !== "open") return;
    const now = Date.now();
    const recent = supportSendTimes.filter((t) => now - t < 10000);
    if (recent.length >= 3) {
      const waitSec = Math.ceil((10000 - (now - recent[0])) / 1000);
      return setErrorMsg(`Не так быстро — подождите ещё ${waitSec} сек.`);
    }
    const targetUserId = supportTarget ? supportTarget.id : session.user.id;
    setSupportInput("");
    const { data, error } = await supabase
      .from("support_messages")
      .insert({ ticket_id: supportTicketId, user_id: targetUserId, sender_id: session.user.id, content: text })
      .select()
      .single();
    if (error) {
      setSupportInput(text);
      return setErrorMsg(error.message);
    }
    setSupportSendTimes([...recent, now]);
    setSupportMessages((prev) => [...prev, data]);
  };



  const getUserTournamentHistory = (uname) => {
    const userTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === uname)).map((t) => t.id);
    if (userTeamIds.length === 0) return [];
    return tournaments
      .filter((t) => (t.tournament_teams || []).some((tt) => userTeamIds.includes(tt.team_id)))
      .map((t) => {
        const matchesForTour = allMatches.filter((m) => m.tournament_id === t.id);
        const maxRound = matchesForTour.reduce((mx, m) => Math.max(mx, m.round), 0);
        const finalMatch = matchesForTour.find((m) => m.round === maxRound && m.team1_id && m.team2_id);
        const isChampion = !!(finalMatch && userTeamIds.includes(finalMatch.winner_id));
        return { id: t.id, name: t.name, mode: t.mode, isChampion };
      })
      .sort((a, b) => (a.isChampion === b.isChampion ? 0 : a.isChampion ? -1 : 1));
  };

  const getUserMatchHistory = (uname) => {
    const userTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === uname)).map((t) => t.id);
    if (userTeamIds.length === 0) return [];
    const localTeamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
    const localTourMap = Object.fromEntries(tournaments.map((t) => [t.id, t]));
    return allMatches
      .filter((m) => m.team1_id && m.team2_id && (userTeamIds.includes(m.team1_id) || userTeamIds.includes(m.team2_id)))
      .map((m) => {
        const myTeamId = userTeamIds.includes(m.team1_id) ? m.team1_id : m.team2_id;
        const oppTeamId = myTeamId === m.team1_id ? m.team2_id : m.team1_id;
        const tour = localTourMap[m.tournament_id];
        const isTeam1 = myTeamId === m.team1_id;
        const myScore = isTeam1 ? m.team1_score : m.team2_score;
        const oppScore = isTeam1 ? m.team2_score : m.team1_score;
        return {
          id: m.id,
          tourName: tour ? tour.name : "—",
          oppName: localTeamMap[oppTeamId] ? teamLabel(localTeamMap[oppTeamId]) : "—",
          round: m.round,
          decided: !!m.winner_id,
          won: m.winner_id === myTeamId,
          myScore: myScore ?? null,
          oppScore: oppScore ?? null,
        };
      })
      .sort((a, b) => b.round - a.round);
  };

  const searchFriendCandidates = async (query) => {
    const q = query.trim();
    if (q.length < 2) {
      setFriendResults([]);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("id, username, avatar_url").ilike("username", `%${q}%`).limit(6);
    if (error) return;
    const already = friends.map((f) => f.id);
    const results = (data || []).filter((p) => p.id !== session?.user.id && !already.includes(p.id));
    setFriendResults(results.slice(0, 5));
  };

  const sendFriendRequest = async (receiverId) => {
    const { error } = await supabase.from("friend_requests").insert({ sender_id: session.user.id, receiver_id: receiverId });
    if (error) return setErrorMsg("Не удалось отправить запрос (возможно, уже отправлен).");
    setFriendQuery("");
    setFriendResults([]);
    refreshFriends(session.user.id);
  };

  const acceptFriendRequest = async (requestId) => {
    const { error } = await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", requestId);
    if (error) return setErrorMsg(error.message);
    refreshFriends(session.user.id);
  };

  const removeFriend = async (requestId) => {
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
    if (error) return setErrorMsg(error.message);
    refreshFriends(session.user.id);
  };

  const currentUsername = profile?.username || null;

  const maxForMode = (mode) => (mode === "5x5" ? 5 : 2);

  const openCreateTeam = () => {
    setTeamName("");
    setShowCreateTeam(true);
  };

  // Загрузка/замена логотипа уже существующей команды (не только при
  // создании) — тот же бакет и путь, что и при создании, поэтому
  // просто перезаписывает файл по тому же имени (team-<id>.<ext>).
  const uploadTeamLogo = async (teamId, file) => {
    if (!file) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `team-logos/${teamId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) return setErrorMsg("Не удалось загрузить логотип: " + upErr.message);
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const logoUrl = `${pub.publicUrl}?t=${Date.now()}`;
      // .select() тут обязателен — без него Supabase может вернуть
      // "успех" (204), даже если RLS тихо заблокировала апдейт и
      // реально не поменяла ни одной строки. Так мы это отличаем.
      const { data: updData, error: updErr } = await supabase.from("teams").update({ logo_url: logoUrl }).eq("id", teamId).select();
      if (updErr) return setErrorMsg("Файл загружен, но не удалось сохранить ссылку в базе: " + updErr.message);
      if (!updData || updData.length === 0) {
        return setErrorMsg("Файл загружен, но запись в базе не обновилась (скорее всего, блокирует RLS-политика на таблице teams) — нужна ещё одна миграция.");
      }
      refreshTeams();
    } catch (err) {
      console.error("uploadTeamLogo:", err);
      setErrorMsg("Не удалось загрузить логотип (неожиданная ошибка): " + (err?.message || String(err)));
    }
  };

  const createTeam = async () => {
    if (!session || !teamName.trim()) return;
    if (!profile?.is_admin && myTeams(createTeamMode).length >= 1) {
      return setErrorMsg(`У вас уже есть команда в режиме ${MODE_LABEL[createTeamMode]} — обычным пользователям доступна только одна команда на режим.`);
    }
    if (containsBlockedLink(teamName)) {
      return setErrorMsg("Название команды не может содержать ссылки/упоминания каналов.");
    }
    if (containsProfanity(teamName)) {
      return setErrorMsg("Название команды содержит недопустимые слова.");
    }
    if (containsNonLatin(teamName)) {
      return setErrorMsg("Название команды можно писать только английскими буквами и цифрами.");
    }
    const max = maxForMode(createTeamMode);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        mode: createTeamMode,
        name: teamName.trim(),
        owner_id: session.user.id,
        max_size: max,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return setErrorMsg("Команда с таким названием уже существует в этом режиме.");
      if (error.code === "42501") return setErrorMsg("Доступна только одна команда на режим.");
      return setErrorMsg(error.message);
    }
    const { error: mErr } = await supabase.from("team_members").insert({ team_id: team.id, member_name: currentUsername });
    if (mErr) setErrorMsg(mErr.message);

    if (newTeamLogoFile) {
      const ext = newTeamLogoFile.name.split(".").pop();
      const path = `team-logos/${team.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, newTeamLogoFile, { upsert: true });
      if (upErr) {
        setErrorMsg("Команда создана, но не удалось загрузить логотип: " + upErr.message);
      } else {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        const logoUrl = `${pub.publicUrl}?t=${Date.now()}`;
        await supabase.from("teams").update({ logo_url: logoUrl }).eq("id", team.id);
      }
    }

    setNewTeamLogoFile(null);
    setNewTeamLogoPreview("");
    setShowCreateTeam(false);
    refreshTeams();
  };

  const myTeams = (mode) => teams.filter((t) => t.mode === mode && t.owner_id === session?.user.id);

  const deleteTeam = async (id) => {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        setErrorMsg("Нельзя удалить команду — она уже участвует в турнире (зарегистрирована или есть в сетке).");
      } else {
        setErrorMsg(error.message);
      }
      setConfirmDeleteTeamId(null);
      return;
    }
    setConfirmDeleteTeamId(null);
    refreshTeams();
  };

  const searchTeammate = async (teamId, query) => {
    const q = query.trim();
    if (q.length < 2) {
      setAddMemberResults((prev) => ({ ...prev, [teamId]: [] }));
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    const taken = (team?.team_members || []).map((m) => m.member_name);
    const { data, error } = await supabase.from("profiles").select("id, username").ilike("username", `%${q}%`).limit(6);
    if (error) return;
    const results = (data || []).filter((p) => !taken.includes(p.username));
    setAddMemberResults((prev) => ({ ...prev, [teamId]: results.slice(0, 5) }));
  };

  const inviteToTeam = async (team, profile) => {
    if ((team.team_members || []).length >= team.max_size) {
      setErrorMsg("Состав команды уже заполнен.");
      return;
    }
    const { error } = await supabase.from("team_invites").insert({ team_id: team.id, invited_id: profile.id });
    if (error) return setErrorMsg("Не удалось отправить приглашение (возможно, уже приглашён).");
    setAddMemberQuery((prev) => ({ ...prev, [team.id]: "" }));
    setAddMemberResults((prev) => ({ ...prev, [team.id]: [] }));
  };

  const acceptTeamInvite = async (invite) => {
    const { error: upErr } = await supabase.from("team_invites").update({ status: "accepted" }).eq("id", invite.id);
    if (upErr) return setErrorMsg(upErr.message);
    const { error: mErr } = await supabase
      .from("team_members")
      .insert({ team_id: invite.team.id, member_name: currentUsername });
    if (mErr) setErrorMsg(mErr.message);
    refreshTeamInvites(session.user.id);
    refreshTeams();
  };

  const declineTeamInvite = async (inviteId) => {
    const { error } = await supabase.from("team_invites").delete().eq("id", inviteId);
    if (error) return setErrorMsg(error.message);
    refreshTeamInvites(session.user.id);
  };

  const createTournament = async () => {
    if (!newTourName.trim()) return;
    setTourCreating(true);
    let banner_url = null;
    if (newTourBannerFile) {
      const path = `${Date.now()}-${newTourBannerFile.name}`.replace(/\s+/g, "_");
      const { error: upErr } = await supabase.storage.from("banners").upload(path, newTourBannerFile);
      if (upErr) {
        setTourCreating(false);
        return setErrorMsg("Не удалось загрузить баннер: " + upErr.message);
      }
      const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
      banner_url = pub.publicUrl;
    }
    const { error } = await supabase.from("tournaments").insert({
      mode: newTourMode,
      name: newTourName.trim(),
      prize_pool: newTourPrize.trim() || null,
      max_teams: newTourMaxTeams,
      banner_url,
      announce_at: newTourAnnounceAt || null,
      reg_open_at: newTourRegOpenAt || null,
      start_at: newTourStartAt || null,
    });
    setTourCreating(false);
    if (error) return setErrorMsg(error.message);
    setNewTourName("");
    setNewTourPrize("");
    setNewTourMaxTeams(8);
    setNewTourBannerFile(null);
    setNewTourAnnounceAt("");
    setNewTourRegOpenAt("");
    setNewTourStartAt("");
    refreshTournaments();
  };

  const deleteTournament = async (id) => {
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) return setErrorMsg(error.message);
    setConfirmDeleteId(null);
    if (expandedTour === id) setExpandedTour(null);
    refreshTournaments();
  };

  const registerTeam = async (tournamentId, teamId) => {
    const { error } = await supabase.from("tournament_teams").insert({ tournament_id: tournamentId, team_id: teamId });
    if (error) return setErrorMsg(error.message);
    refreshTournaments();
  };

  const unregisterTeam = async (tournamentId, teamId) => {
    const { error } = await supabase.from("tournament_teams").delete().eq("tournament_id", tournamentId).eq("team_id", teamId);
    if (error) return setErrorMsg(error.message);
    refreshTournaments();
  };

  const saveAdSlot = async (ad, file) => {
    setAdUploading((prev) => ({ ...prev, [ad.slot]: true }));
    let image_url = ad.image_url;
    if (file) {
      // Имя файла НЕ должно содержать слова вроде slot/ad/banner/sponsor —
      // блокировщики (Opera) режут по подстроке в URL, а не по домену.
      // Раньше тут было "slot-1-...", из-за чего картинки продолжали
      // блокироваться даже после трёх переименований таблицы и бакета.
      const path = `${ad.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("showcase").upload(path, file);
      if (upErr) {
        setAdUploading((prev) => ({ ...prev, [ad.slot]: false }));
        return setErrorMsg("Не удалось загрузить картинку: " + upErr.message);
      }
      const { data: pub } = supabase.storage.from("showcase").getPublicUrl(path);
      image_url = pub.publicUrl;
    }
    const link_url = adLinkDrafts[ad.slot] !== undefined ? adLinkDrafts[ad.slot] : ad.link_url || "";
    const rawExpiry = adExpiryDrafts[ad.slot] !== undefined ? adExpiryDrafts[ad.slot] : null;
    const expires_at = rawExpiry !== null ? (rawExpiry ? new Date(rawExpiry).toISOString() : null) : ad.expires_at || null;
    const { error } = await supabase
      .from("showcase")
      .update({ image_url, link_url, expires_at, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", ad.id);
    setAdUploading((prev) => ({ ...prev, [ad.slot]: false }));
    if (error) return setErrorMsg(error.message);
    refreshAds();
  };

  const toggleAdActive = async (ad) => {
    const { error } = await supabase.from("showcase").update({ is_active: !ad.is_active }).eq("id", ad.id);
    if (error) return setErrorMsg(error.message);
    refreshAds();
  };

  const saveMapImage = async (mapKey, file) => {
    setMapImageUploading((prev) => ({ ...prev, [mapKey]: true }));
    const path = `${mapKey}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: upErr } = await supabase.storage.from("map-covers").upload(path, file);
    if (upErr) {
      setMapImageUploading((prev) => ({ ...prev, [mapKey]: false }));
      return setErrorMsg("Не удалось загрузить картинку: " + upErr.message);
    }
    const { data: pub } = supabase.storage.from("map-covers").getPublicUrl(path);
    const { error } = await supabase
      .from("map_images")
      .upsert({ map_key: mapKey, image_url: pub.publicUrl, updated_at: new Date().toISOString() }, { onConflict: "map_key" });
    setMapImageUploading((prev) => ({ ...prev, [mapKey]: false }));
    if (error) return setErrorMsg(error.message);
    refreshMapImages();
  };

  const removeMapImage = async (mapKey) => {
    const { error } = await supabase.from("map_images").update({ image_url: null }).eq("map_key", mapKey);
    if (error) return setErrorMsg(error.message);
    refreshMapImages();
  };

  // Создаёт запись "готовности" для матча, если у него уже известны ОБЕ
  // команды (не bye) и такой записи ещё нет — тогда обеим командам даётся
  // 1 минута на подтверждение "Принять" прежде чем можно будет играть.
  const ensureReadyCheck = async (tournamentId, matchId, round, matchIndex, team1Id, team2Id) => {
    if (!team1Id || !team2Id) return;
    const deadline = new Date(Date.now() + 60 * 1000).toISOString();
    await supabase
      .from("match_ready_checks")
      .upsert(
        { match_id: matchId, tournament_id: tournamentId, round, match_index: matchIndex, team1_id: team1Id, team2_id: team2Id, deadline },
        { onConflict: "match_id", ignoreDuplicates: true }
      );
    refreshReadyChecks();
  };

  // Присуждает победу winnerTeamId в конкретном матче сетки (техническое
  // поражение соперника) и проталкивает победителя в следующий раунд —
  // не завязано на открытую админом сетку (expandedRounds), поэтому
  // может быть вызвано из любого места, включая браузер обычного игрока.
  const forfeitWinner = async (tournamentId, matchId, round, matchIndex, winnerTeamId) => {
    await supabase.from("matches").update({ winner_id: winnerTeamId }).eq("id", matchId);
    const { data: allRows } = await supabase.from("matches").select("round").eq("tournament_id", tournamentId);
    const totalRounds = allRows?.length ? Math.max(...allRows.map((m) => m.round)) + 1 : 0;
    if (round + 1 < totalRounds) {
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const slotField = matchIndex % 2 === 0 ? "team1_id" : "team2_id";
      const { data: nextMatch } = await supabase
        .from("matches")
        .select("id, round, match_index, team1_id, team2_id")
        .eq("tournament_id", tournamentId)
        .eq("round", round + 1)
        .eq("match_index", nextMatchIndex)
        .single();
      if (nextMatch) {
        await supabase.from("matches").update({ [slotField]: winnerTeamId, winner_id: null }).eq("id", nextMatch.id);
        const otherField = slotField === "team1_id" ? "team2_id" : "team1_id";
        const otherTeamId = nextMatch[otherField];
        if (otherTeamId) await ensureReadyCheck(tournamentId, nextMatch.id, nextMatch.round, nextMatch.match_index, winnerTeamId, otherTeamId);
      }
    } else {
      await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournamentId);
      refreshTournaments();
    }
    await autoResolveByes(tournamentId);
    refreshAllMatches();
    if (expandedTour === tournamentId) loadBracket(tournamentId);
  };

  // Проверяет один "просроченный" ready-check и, если время истекло и
  // одна из команд так и не нажала "Принять", присуждает техническое
  // поражение. Перечитывает свежую строку из базы перед решением, чтобы
  // не спорить с другим браузером, который мог обработать её первым.
  const resolveExpiredReadyCheck = async (rc) => {
    const { data: fresh } = await supabase.from("match_ready_checks").select("*").eq("id", rc.id).single();
    if (!fresh || fresh.status !== "pending") return;
    if (new Date(fresh.deadline) > new Date()) return;
    const team1Ok = !!fresh.team1_accepted_at;
    const team2Ok = !!fresh.team2_accepted_at;
    if (team1Ok && team2Ok) return;
    if (!team1Ok && !team2Ok) {
      // ни одна команда не приняла — не решаем автоматически, кто прав,
      // просто помечаем как требующий ручного вмешательства админа
      await supabase.from("match_ready_checks").update({ status: "team1_forfeit" }).eq("id", fresh.id);
      return;
    }
    const winnerTeamId = team1Ok ? fresh.team1_id : fresh.team2_id;
    const newStatus = team1Ok ? "team2_forfeit" : "team1_forfeit";
    await supabase.from("match_ready_checks").update({ status: newStatus }).eq("id", fresh.id);
    await forfeitWinner(fresh.tournament_id, fresh.match_id, fresh.round, fresh.match_index, winnerTeamId);
  };

  // Аварийный сброс для админа — если что-то зависло (тестовые данные,
  // сбой), можно принудительно удалить окно "Принять" или бан карт.
  const cancelReadyCheck = async (rc) => {
    await supabase.from("match_ready_checks").delete().eq("id", rc.id);
    refreshReadyChecks();
  };

  const cancelVeto = async (veto) => {
    await supabase.from("match_vetoes").delete().eq("id", veto.id);
    refreshMatchVetoes();
  };

  const acceptReadyCheck = async (rc) => {
    try {
      const audio = new Audio(sndAccept);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (_) {
      // звук не проигрался — не критично, само принятие всё равно пройдёт
    }
    const myTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === currentUsername)).map((t) => t.id);
    const isTeam1 = myTeamIds.includes(rc.team1_id);
    const field = isTeam1 ? "team1_accepted_at" : "team2_accepted_at";
    const { data, error } = await supabase
      .from("match_ready_checks")
      .update({ [field]: new Date().toISOString() })
      .eq("id", rc.id)
      .select()
      .single();
    if (error) return setErrorMsg(error.message);
    if (data.team1_accepted_at && data.team2_accepted_at) {
      await supabase.from("match_ready_checks").update({ status: "both_accepted" }).eq("id", rc.id);
      // Обе команды готовы — запускаем бан карт. Кто банит первым решаем
      // случайно; upsert с ignoreDuplicates защищает от повторного
      // создания, если оба клиента одновременно это заметят.
      const firstTurnTeamId = Math.random() < 0.5 ? rc.team1_id : rc.team2_id;
      await supabase.from("match_vetoes").upsert(
        {
          match_id: rc.match_id,
          tournament_id: rc.tournament_id,
          team1_id: rc.team1_id,
          team2_id: rc.team2_id,
          maps_remaining: MAP_POOL,
          banned_maps: [],
          current_turn_team_id: firstTurnTeamId,
          turn_deadline: new Date(Date.now() + 15000).toISOString(),
        },
        { onConflict: "match_id", ignoreDuplicates: true }
      );
      refreshMatchVetoes();
    }
    refreshReadyChecks();
  };

  // Сам бан карты (без проверки прав капитана) — общая логика для
  // ручного бана (после проверки в banMap) и автобана по таймауту
  // (autoBanExpiredVeto). byTeamId — от чьего имени записывается бан.
  const executeBan = async (veto, mapKey, byTeamId) => {
    const remaining = veto.maps_remaining.filter((m) => m !== mapKey);
    const newBanned = [...veto.banned_maps, { map: mapKey, team_id: byTeamId, order: veto.banned_maps.length + 1 }];
    if (remaining.length === 1) {
      await supabase
        .from("match_vetoes")
        .update({
          maps_remaining: remaining,
          banned_maps: newBanned,
          final_map: remaining[0],
          status: "completed",
          current_turn_team_id: null,
          turn_deadline: null,
        })
        .eq("id", veto.id);

      // Режим и карта уже известны на этом этапе (сторона CT/T ещё нет,
      // но она боту и не нужна) — сразу заводим задачу для бота на
      // создание лобби на CyberShoke. На всякий случай подстраховываемся:
      // если локальное состояние tournaments почему-то не содержит этот
      // турнир, догружаем его прямо из базы, а не молча пропускаем шаг.
      let tourForLobby = tournaments.find((t) => t.id === veto.tournament_id);
      if (!tourForLobby) {
        const { data: freshTour, error: tourErr } = await supabase.from("tournaments").select("mode").eq("id", veto.tournament_id).single();
        if (tourErr) console.error("Не удалось найти турнир для задачи боту:", tourErr.message);
        tourForLobby = freshTour;
      }
      if (tourForLobby) {
        const { error: lobbyErr } = await supabase.from("match_lobbies").upsert(
          {
            match_id: veto.match_id,
            tournament_id: veto.tournament_id,
            team1_id: veto.team1_id,
            team2_id: veto.team2_id,
            mode: tourForLobby.mode,
            map: remaining[0],
          },
          { onConflict: "match_id", ignoreDuplicates: true }
        );
        if (lobbyErr) {
          console.error("Не удалось создать задачу для бота (match_lobbies):", lobbyErr.message);
          setErrorMsg("Не удалось поставить задачу боту: " + lobbyErr.message);
        }
        refreshMatchLobbies();
      } else {
        console.error("Турнир не найден совсем — задача для бота не создана. tournament_id:", veto.tournament_id);
      }
    } else {
      const nextTurn = veto.current_turn_team_id === veto.team1_id ? veto.team2_id : veto.team1_id;
      await supabase
        .from("match_vetoes")
        .update({
          maps_remaining: remaining,
          banned_maps: newBanned,
          current_turn_team_id: nextTurn,
          turn_deadline: new Date(Date.now() + 15000).toISOString(),
        })
        .eq("id", veto.id);
    }
    refreshMatchVetoes();
  };

  const banMap = async (veto, mapKey) => {
    const myTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === currentUsername)).map((t) => t.id);
    const captainTeam = teams.find((t) => t.owner_id === session?.user.id && myTeamIds.includes(t.id) && (t.id === veto.team1_id || t.id === veto.team2_id));
    if (!captainTeam || captainTeam.id !== veto.current_turn_team_id) return;
    await executeBan(veto, mapKey, captainTeam.id);
  };

  // Если капитан не успел забанить карту за 15 секунд — банит случайную
  // карту из оставшихся вместо него, чтобы веток не завис намертво.
  // Может сработать на экране ЛЮБОГО зрителя этого матча (не только
  // капитана) — читает свежую строку перед баном, чтобы не забанить
  // дважды, если несколько браузеров заметили таймаут одновременно или
  // капитан всё-таки успел кликнуть в последний момент.
  const autoBanExpiredVeto = async (veto) => {
    const { data: fresh } = await supabase.from("match_vetoes").select("*").eq("id", veto.id).single();
    if (!fresh || fresh.status === "completed") return;
    if (!fresh.turn_deadline || new Date(fresh.turn_deadline) > new Date()) return;
    if (!fresh.maps_remaining || !fresh.maps_remaining.length) return;
    const randomMap = fresh.maps_remaining[Math.floor(Math.random() * fresh.maps_remaining.length)];
    await executeBan(fresh, randomMap, fresh.current_turn_team_id);
  };

  // Тикающий таймер для отображения обратного отсчёта в окне "Принять".
  // Панель профиля закрывается кликом снаружи (без затемняющей подложки —
  // чтобы остальным меню/сайтом можно было пользоваться, пока панель открыта).
  useEffect(() => {
    if (!navMenuOpen) return;
    const handleClickOutside = (e) => {
      if (navPanelRef.current && navPanelRef.current.contains(e.target)) return;
      if (avatarPillRef.current && avatarPillRef.current.contains(e.target)) return;
      setNavMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [navMenuOpen]);

  useEffect(() => {
    const id = setInterval(() => setReadyCheckNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Бип на каждую секунду обратного отсчёта в окне "Принять" — как в
  // CS2 при подтверждении матча. На последних 5 секундах тик звучит
  // чуть быстрее/выше (playbackRate), для ощущения срочности. Раньше
  // тут был синтезированный через Web Audio писк — заменили на реальный
  // короткий звук (tick-sound.mp3, обрезанный из присланного файла).
  // Своя собственная секундная проверка (не завязана на readyCheckNow
  // выше) — опрашивает чаще (раз в 250мс), чтобы не проскочить нужную
  // целую секунду.
  const lastBeepSecondRef = useRef(null);
  const playCountdownBeep = (urgent) => {
    try {
      const audio = new Audio(sndTick);
      audio.volume = 0.45;
      audio.playbackRate = urgent ? 1.25 : 1;
      audio.play().catch(() => {});
    } catch (_) {
      // звук не проигрался — не критично, сам отсчёт всё равно идёт
    }
  };
  useEffect(() => {
    if (!currentUsername) return;
    const myTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === currentUsername)).map((t) => t.id);
    const myReadyCheck = readyChecks.find((rc) => {
      if (rc.status !== "pending") return false;
      const isTeam1 = myTeamIds.includes(rc.team1_id);
      const isTeam2 = myTeamIds.includes(rc.team2_id);
      if (!isTeam1 && !isTeam2) return false;
      const alreadyAccepted = isTeam1 ? !!rc.team1_accepted_at : !!rc.team2_accepted_at;
      return !alreadyAccepted;
    });
    if (!myReadyCheck) {
      lastBeepSecondRef.current = null;
      return;
    }
    const id = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((new Date(myReadyCheck.deadline).getTime() - Date.now()) / 1000));
      if (secondsLeft > 0 && secondsLeft !== lastBeepSecondRef.current) {
        lastBeepSecondRef.current = secondsLeft;
        playCountdownBeep(secondsLeft <= 5);
      }
    }, 250);
    return () => clearInterval(id);
  }, [currentUsername, readyChecks, teams]);

  // Периодически проверяем, не истекло ли время на принятие у кого-то из
  // видимых нам ready-check'ов — если да, присуждаем техническое поражение.
  useEffect(() => {
    const id = setInterval(() => {
      readyChecks.forEach((rc) => {
        if (new Date(rc.deadline) <= new Date()) resolveExpiredReadyCheck(rc);
      });
    }, 3000);
    return () => clearInterval(id);
  }, [readyChecks]);

  // Периодически проверяем, не истекли ли 15 секунд на ход в бане карт —
  // если капитан не успел кликнуть, банит случайную карту вместо него.
  useEffect(() => {
    const id = setInterval(() => {
      matchVetoes.forEach((v) => {
        if (v.status !== "completed" && v.turn_deadline && new Date(v.turn_deadline) <= new Date()) autoBanExpiredVeto(v);
      });
    }, 2000);
    return () => clearInterval(id);
  }, [matchVetoes]);

  // Подстраховка на случай, если realtime-обновление вдруг "не долетит"
  // (например, кратковременно оборвалось соединение) — раз в 4 секунды
  // всё равно подтягиваем свежее состояние бана карт/монетки/лобби,
  // пока идёт матч, чтобы не пришлось обновлять страницу руками.
  useEffect(() => {
    const id = setInterval(() => {
      if (matchVetoes.length) refreshMatchVetoes();
      if (matchLobbies.length) refreshMatchLobbies();
    }, 4000);
    return () => clearInterval(id);
  }, [matchVetoes.length, matchLobbies.length, refreshMatchVetoes, refreshMatchLobbies]);

  const autoResolveByes = async (tournamentId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("id, round, match_index, team1_id, team2_id, winner_id")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("match_index");
    if (error || !data || !data.length) return;
    const totalRounds = Math.max(...data.map((m) => m.round)) + 1;
    const rounds = Array.from({ length: totalRounds }, () => []);
    data.forEach((m) => {
      rounds[m.round][m.match_index] = { ...m };
    });

    // dead[r][i] = true only if this match slot can structurally NEVER receive a team
    // (i.e. both its own slots are empty at round 0, or both its feeder matches are dead).
    // A slot that's simply "not decided yet" by a real, still-open match is NOT dead.
    const dead = Array.from({ length: totalRounds }, () => []);
    for (let r = 0; r < totalRounds; r++) {
      rounds[r].forEach((m, i) => {
        if (!m) {
          dead[r][i] = true;
          return;
        }
        if (r === 0) {
          dead[r][i] = !m.team1_id && !m.team2_id;
        } else {
          const d1 = dead[r - 1][i * 2];
          const d2 = dead[r - 1][i * 2 + 1];
          dead[r][i] = !!d1 && !!d2;
        }
      });
    }

    const updates = {};
    const markUpdate = (id, field, value) => {
      updates[id] = { ...(updates[id] || {}), [field]: value };
    };

    let becameFinished = false;
    for (let r = 0; r < totalRounds; r++) {
      rounds[r].forEach((m, i) => {
        if (!m || m.winner_id) return;
        let forcedWinner = null;
        if (r === 0) {
          if (m.team1_id && !m.team2_id) forcedWinner = m.team1_id;
          else if (m.team2_id && !m.team1_id) forcedWinner = m.team2_id;
        } else {
          const leftDead = dead[r - 1][i * 2];
          const rightDead = dead[r - 1][i * 2 + 1];
          if (m.team1_id && !m.team2_id && rightDead) forcedWinner = m.team1_id;
          else if (m.team2_id && !m.team1_id && leftDead) forcedWinner = m.team2_id;
        }
        if (!forcedWinner) return;
        m.winner_id = forcedWinner;
        markUpdate(m.id, "winner_id", forcedWinner);
        if (r + 1 < totalRounds) {
          const next = rounds[r + 1][Math.floor(i / 2)];
          if (next) {
            const field = i % 2 === 0 ? "team1_id" : "team2_id";
            next[field] = forcedWinner;
            markUpdate(next.id, field, forcedWinner);
          }
        } else {
          becameFinished = true;
        }
      });
    }

    const ids = Object.keys(updates);
    if (ids.length) {
      for (const id of ids) {
        await supabase.from("matches").update(updates[id]).eq("id", id);
      }
      if (becameFinished) {
        await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournamentId);
        refreshTournaments();
      }
    }

    // Любой матч, где теперь известны ОБЕ команды и он ещё не сыгран —
    // должен получить окно "Принять" (если ещё не получил). НО только
    // если турнир реально СТАРТОВАЛ (status === "live") — иначе окна
    // "Принять" появлялись сразу при формировании сетки, ещё до того
    // как админ явно нажал "Начать турнир". Читаем статус свежим из
    // базы, а не из локального состояния — эта функция вызывается сразу
    // после смены статуса, когда React state ещё может быть неактуален.
    const { data: tourRow } = await supabase.from("tournaments").select("status").eq("id", tournamentId).single();
    if (tourRow && tourRow.status === "live") {
      for (let r = 0; r < totalRounds; r++) {
        for (const m of rounds[r]) {
          if (m && m.team1_id && m.team2_id && !m.winner_id) {
            await ensureReadyCheck(tournamentId, m.id, r, m.match_index, m.team1_id, m.team2_id);
          }
        }
      }
    }

    refreshAllMatches();
  };

  // Скачивает сетку как PNG-картинку: html2canvas рендерит саму сетку
  // (карточки команд, счёт, коннекторы) как есть на странице, поверх
  // дорисовывается простая шапка "NUR TOURNAMENTS" + название турнира
  // через обычный Canvas 2D — без этого пакета не работает, поэтому
  // сначала пробуем его динамически импортировать и мягко подсказываем,
  // если он не установлен в проекте (npm install html2canvas), вместо
  // того чтобы ронять всю страницу неудачным импортом при загрузке.
  const downloadBracketImage = async (tourName, tourModeLabel) => {
    const target = bracketCaptureRef.current;
    if (!target) return;
    let html2canvas;
    try {
      html2canvas = (await import("html2canvas")).default;
    } catch (e) {
      setErrorMsg("Для скачивания сетки нужно добавить пакет html2canvas в package.json (npm install html2canvas) и задеплоить заново.");
      return;
    }
    const scale = 2;
    const bracketCanvas = await html2canvas(target, {
      backgroundColor: "#0B0708",
      scale,
      onclone: (doc, el) => {
        // По умолчанию html2canvas видит только то, что помещается в
        // overflow:auto — временно (только в клонированном для рендера
        // документе, не в реальной странице) раскрываем контейнер на
        // полную ширину/высоту содержимого, чтобы попали все раунды,
        // включая те что были доступны только через горизонтальный скролл.
        el.style.overflow = "visible";
        el.style.width = target.scrollWidth + "px";
        el.style.height = target.scrollHeight + "px";
      },
    });

    const headerH = 90 * scale;
    const pad = 24 * scale;
    const out = document.createElement("canvas");
    out.width = bracketCanvas.width + pad * 2;
    out.height = bracketCanvas.height + headerH + pad * 2;
    const ctx = out.getContext("2d");

    ctx.fillStyle = "#0B0708";
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.textBaseline = "alphabetic";
    ctx.font = `${34 * scale}px Anton, sans-serif`;
    ctx.fillStyle = "#F3ECEA";
    ctx.fillText("NUR ", pad, 50 * scale);
    const nurWidth = ctx.measureText("NUR ").width;
    ctx.fillStyle = "#D9414C";
    ctx.fillText("TOURNAMENTS", pad + nurWidth, 50 * scale);

    ctx.font = `${15 * scale}px sans-serif`;
    ctx.fillStyle = "#AE9B99";
    ctx.fillText(`${tourName} · ${tourModeLabel}`, pad, 74 * scale);

    ctx.drawImage(bracketCanvas, pad, headerH + pad);

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tourName.replace(/[^a-zA-Zа-яА-Я0-9]+/g, "_")}_bracket.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const loadBracket = async (tournamentId) => {
    await autoResolveByes(tournamentId);
    const { data, error } = await supabase
      .from("matches")
      .select("id, round, match_index, team1_id, team2_id, winner_id, team1_score, team2_score")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("match_index");
    if (error) return setErrorMsg(error.message);
    const totalRounds = data.length ? Math.max(...data.map((m) => m.round)) + 1 : 0;
    const rounds = Array.from({ length: totalRounds }, () => []);
    data.forEach((m) => {
      rounds[m.round][m.match_index] = m;
    });
    setExpandedRounds(rounds);
  };

  const toggleExpand = async (tournamentId, hasBracket) => {
    if (expandedTour === tournamentId) {
      setExpandedTour(null);
      setExpandedRounds(null);
      return;
    }
    setExpandedTour(tournamentId);
    if (hasBracket) await loadBracket(tournamentId);
  };

  const generateBracket = async (tournamentId) => {
    const tour = tournaments.find((t) => t.id === tournamentId);
    const teamIds = (tour.tournament_teams || []).map((tt) => tt.team_id);
    if (teamIds.length < 2) return;

    const shuffled = shuffleArr(teamIds);
    const size = Math.max(2, nextPow2(shuffled.length));
    while (shuffled.length < size) shuffled.push(null);
    const totalRounds = Math.log2(size);

    const roundsArr = [];
    const round0 = [];
    for (let i = 0; i < size / 2; i++) {
      const team1_id = shuffled[i * 2];
      const team2_id = shuffled[i * 2 + 1];
      let winner_id = null;
      if (team1_id && !team2_id) winner_id = team1_id;
      else if (team2_id && !team1_id) winner_id = team2_id;
      round0.push({ round: 0, match_index: i, team1_id, team2_id, winner_id });
    }
    roundsArr.push(round0);
    for (let r = 1; r < totalRounds; r++) {
      const count = size / Math.pow(2, r + 1);
      const round = [];
      for (let i = 0; i < count; i++) round.push({ round: r, match_index: i, team1_id: null, team2_id: null, winner_id: null });
      roundsArr.push(round);
    }
    round0.forEach((m, i) => {
      if (m.winner_id && roundsArr[1]) {
        const next = roundsArr[1][Math.floor(i / 2)];
        if (i % 2 === 0) next.team1_id = m.winner_id;
        else next.team2_id = m.winner_id;
      }
    });

    const rows = roundsArr.flat().map((m) => ({ tournament_id: tournamentId, ...m }));
    const { error } = await supabase.from("matches").insert(rows);
    if (error) return setErrorMsg(error.message);
    // Статус "bracket_ready", а не "live" — пары уже видны всем, но окна
    // "Принять" ещё не создаются, пока админ явно не нажмёт "Начать турнир".
    const { error: statusErr } = await supabase.from("tournaments").update({ status: "bracket_ready" }).eq("id", tournamentId);
    if (statusErr) setErrorMsg("Сетка создана, но не удалось сменить статус турнира: " + statusErr.message);
    refreshTournaments();
    refreshAllMatches();
    setExpandedTour(tournamentId);
    loadBracket(tournamentId);
  };

  // Явный запуск турнира после того, как сетка уже сформирована и админ
  // проверил пары. Только теперь появляются окна "Принять" для матчей
  // первого раунда — раньше это происходило автоматически сразу при
  // формировании сетки, что и было тем самым багом.
  const startTournament = async (tournamentId) => {
    const { error } = await supabase.from("tournaments").update({ status: "live" }).eq("id", tournamentId);
    if (error) return setErrorMsg(error.message);
    refreshTournaments();
    await autoResolveByes(tournamentId); // теперь статус уже "live" — этот же проход создаст ready-check'и для готовых матчей
    if (expandedTour === tournamentId) loadBracket(tournamentId);
  };

  const declareWinner = async (tournamentId, matchRow, winnerTeamId) => {
    const { error } = await supabase.from("matches").update({ winner_id: winnerTeamId }).eq("id", matchRow.id);
    if (error) return setErrorMsg(error.message);

    const totalRounds = expandedRounds.length;
    if (matchRow.round + 1 < totalRounds) {
      const nextMatchIndex = Math.floor(matchRow.match_index / 2);
      const slotField = matchRow.match_index % 2 === 0 ? "team1_id" : "team2_id";
      const { data: nextMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("round", matchRow.round + 1)
        .eq("match_index", nextMatchIndex)
        .single();
      if (nextMatch) {
        await supabase.from("matches").update({ [slotField]: winnerTeamId, winner_id: null }).eq("id", nextMatch.id);
      }
    } else {
      await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournamentId);
      refreshTournaments();
    }
    refreshAllMatches();
    loadBracket(tournamentId);
  };

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

  const computeLeaderboard = (mode) => {
    const tourIds = new Set(tournaments.filter((t) => t.mode === mode).map((t) => t.id));
    const relevant = allMatches.filter((m) => tourIds.has(m.tournament_id));
    const maxRoundByTour = {};
    relevant.forEach((m) => {
      maxRoundByTour[m.tournament_id] = Math.max(maxRoundByTour[m.tournament_id] || 0, m.round);
    });
    const stats = {};
    relevant.forEach((m) => {
      if (!stats[m.winner_id]) stats[m.winner_id] = { id: m.winner_id, wins: 0, titles: 0 };
      const wasRealMatch = !!(m.team1_id && m.team2_id);
      if (wasRealMatch) stats[m.winner_id].wins += 1;
      if (m.round === maxRoundByTour[m.tournament_id] && wasRealMatch) stats[m.winner_id].titles += 1;
    });
    return Object.values(stats)
      .map((s) => ({ ...s, name: teamMap[s.id] ? teamLabel(teamMap[s.id]) : "—" }))
      .sort((a, b) => b.titles - a.titles || b.wins - a.wins)
      .slice(0, 10);
  };

  if (authLoading) {
    return (
      <div style={styles.loadingWrap}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} color="#D9414C" />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#AE9B99", fontSize: 13 }}>
          ЗАГРУЗКА ПЛАТФОРМЫ...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const tourList = tournaments;
  const leaderboard5x5 = computeLeaderboard("5x5");
  const leaderboard2x2 = computeLeaderboard("2x2");

  // ==========================================================
  // Данные для новой главной страницы
  // ==========================================================

  // У matches нет колонки с датой, поэтому «свежесть» определяем по
  // порядку турниров (они грузятся с .order("created_at")), затем по раунду.
  const tourOrderIdx = Object.fromEntries(tournaments.map((t, i) => [t.id, i]));
  const tourById = Object.fromEntries(tournaments.map((t) => [t.id, t]));

  const roundLabelShort = (i, total) => {
    const fromEnd = total - 1 - i;
    if (fromEnd === 0) return "ФИНАЛ";
    if (fromEnd === 1) return "1/2 ФИНАЛА";
    if (fromEnd === 2) return "1/4 ФИНАЛА";
    if (fromEnd === 3) return "1/8 ФИНАЛА";
    return `РАУНД ${i + 1}`;
  };

  const playedMatches = allBracketMatches.filter((m) => m.team1_id && m.team2_id && m.winner_id);

  // Лестница: победы, поражения, винрейт и очки. Титул засчитываем только
  // в РЕАЛЬНО завершённом турнире, иначе лидер незаконченной сетки
  // получал бы чемпионство авансом.
  const buildLadder = (mode) => {
    const tourIds = new Set(tournaments.filter((t) => t.mode === mode).map((t) => t.id));
    const rel = playedMatches.filter((m) => tourIds.has(m.tournament_id));
    const maxRoundByTour = {};
    rel.forEach((m) => {
      maxRoundByTour[m.tournament_id] = Math.max(maxRoundByTour[m.tournament_id] || 0, m.round);
    });
    const st = {};
    const touch = (id) => {
      if (!st[id]) st[id] = { id, wins: 0, losses: 0, titles: 0 };
      return st[id];
    };
    rel.forEach((m) => {
      const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
      touch(m.winner_id).wins += 1;
      touch(loserId).losses += 1;
      const tour = tourById[m.tournament_id];
      if (tour && tour.status === "finished" && m.round === maxRoundByTour[m.tournament_id]) {
        touch(m.winner_id).titles += 1;
      }
    });
    return Object.values(st)
      .map((s) => {
        const played = s.wins + s.losses;
        return {
          ...s,
          played,
          wr: played ? Math.round((s.wins / played) * 100) : 0,
          points: s.titles * 100 + s.wins * 10,
          team: teamMap[s.id],
        };
      })
      .filter((s) => s.team)
      .sort((a, b) => b.points - a.points || b.wr - a.wr || b.wins - a.wins)
      .slice(0, 5);
  };

  const homeLadder = buildLadder(leaderboardMode);

  // Живые матчи берём из match_lobbies (бот держит там статус сервера).
  const liveLobbies = matchLobbies
    .filter((l) => l.status === "ready" || l.status === "started")
    .slice(0, 4);

  // Лента последних результатов для бегущей строки и карточек.
  const recentResults = playedMatches
    .filter((m) => m.team1_score != null && m.team2_score != null)
    .slice()
    .sort(
      (a, b) =>
        (tourOrderIdx[b.tournament_id] ?? 0) - (tourOrderIdx[a.tournament_id] ?? 0) ||
        b.round - a.round ||
        b.match_index - a.match_index
    )
    .slice(0, 10);

  // Обратный отсчёт до старта ближайшего запланированного турнира.
  const upcomingTour = tournaments
    .filter((t) => t.start_at && new Date(t.start_at).getTime() > nowTs)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

  const countdownParts = (() => {
    if (!upcomingTour) return null;
    let diff = Math.max(0, new Date(upcomingTour.start_at).getTime() - nowTs);
    const d = Math.floor(diff / 86400000);
    diff -= d * 86400000;
    const h = Math.floor(diff / 3600000);
    diff -= h * 3600000;
    const mi = Math.floor(diff / 60000);
    const s = Math.floor((diff - mi * 60000) / 1000);
    return { d, h, mi, s };
  })();

  const pad2 = (n) => String(n).padStart(2, "0");

  // Турнир для мини-сетки: сначала идущий, затем готовый к старту.
  const featuredTour =
    tournaments.find((t) => t.status === "live") || tournaments.find((t) => t.status === "bracket_ready") || null;

  const buildRounds = (tourId) => {
    const ms = allBracketMatches.filter((m) => m.tournament_id === tourId);
    if (!ms.length) return [];
    const total = Math.max(...ms.map((m) => m.round)) + 1;
    const rounds = Array.from({ length: total }, () => []);
    ms.forEach((m) => {
      rounds[m.round][m.match_index] = m;
    });
    return rounds;
  };

  const featuredRounds = featuredTour ? buildRounds(featuredTour.id) : [];
  const featuredPlayed = featuredTour
    ? allBracketMatches.filter((m) => m.tournament_id === featuredTour.id && m.winner_id).length
    : 0;
  const featuredTotal = featuredTour ? allBracketMatches.filter((m) => m.tournament_id === featuredTour.id).length : 0;
  const featuredStageLabel = (() => {
    if (!featuredTour || !featuredRounds.length) return "—";
    const total = featuredRounds.length;
    for (let i = 0; i < total; i++) {
      const undecided = featuredRounds[i].some((m) => m && m.team1_id && m.team2_id && !m.winner_id);
      if (undecided) return roundLabelShort(i, total);
    }
    return roundLabelShort(total - 1, total);
  })();

  // Ближайший несыгранный матч действующей сетки — для панели VS в шапке.
  const nextMatch = featuredRounds.length
    ? featuredRounds.flat().find((m) => m && m.team1_id && m.team2_id && !m.winner_id) || null
    : null;
  const nextMatchLabel = nextMatch ? roundLabelShort(nextMatch.round, featuredRounds.length) : "";

  // Турнир с открытой регистрацией — чтобы правая панель шапки не пустовала,
  // когда дата старта ещё не назначена.
  const registrationTour = tournaments.find((t) => t.status === "registration") || null;
  const registrationCount = registrationTour ? (registrationTour.tournament_teams || []).length : 0;
  const registrationCap = registrationTour && registrationTour.max_teams ? registrationTour.max_teams : null;

  // Нумерация секций подстраивается: если матчей ещё нет, «В эфире» не
  // рендерится, и лестница должна стать 01, а не висеть как 02.
  const hasLiveSection = liveLobbies.length > 0 || recentResults.length > 0;
  const secNoLadder = hasLiveSection ? "02" : "01";
  const secNoTours = hasLiveSection ? "03" : "02";

  const shortTeamName = (t) => {
    if (!t) return "—";
    const n = teamLabel(t);
    return n.length > 14 ? n.slice(0, 13) + "…" : n;
  };

  const renderBracket = (tournamentId, rounds, interactive, captureRef) => {
    if (!rounds || rounds.length === 0) return null;
    const g = computeGeometry(rounds);
    const totalRounds = rounds.length;
    return (
      <div ref={captureRef} className="nur-bracket-scroll" style={{ overflowX: "auto", paddingTop: 46, paddingBottom: 10 }}>
        <div style={{ position: "relative", height: g.containerHeight, width: g.width, minWidth: g.width }}>
          <svg width={g.width} height={g.containerHeight} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            {g.connectors.map((c) => (
              <g key={c.key} stroke="#F3ECEA4D" strokeWidth="1.5" fill="none">
                <line x1={c.xLeft} y1={c.y1} x2={c.xMid} y2={c.y1} />
                <line x1={c.xLeft} y1={c.y2} x2={c.xMid} y2={c.y2} />
                <line x1={c.xMid} y1={c.y1} x2={c.xMid} y2={c.y2} />
                <line x1={c.xMid} y1={c.yMid} x2={c.xLeft + ROUND_GAP} y2={c.yMid} />
              </g>
            ))}
          </svg>
          {rounds.map((round, r) => (
            <div key={r}>
              <div
                style={{
                  position: "absolute",
                  top: -42,
                  left: r * (CARD_W + ROUND_GAP),
                  width: CARD_W,
                  textAlign: "center",
                }}
              >
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 13, letterSpacing: 1.5, color: "#F3ECEA" }}>
                  {roundLabelEN(totalRounds, r)}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: 0.5, color: "#E8A33D", marginTop: 2 }}>
                  {roundLabelSub(totalRounds, r)}
                </div>
              </div>
              {round.map((m, i) => {
                if (!m) return null;
                const y = g.centerY(r, i) - CARD_H / 2;
                const t1 = teamMap[m.team1_id];
                const t2 = teamMap[m.team2_id];
                const canDecide = interactive && m.team1_id && m.team2_id;
                return (
                  <div key={m.id} style={{ position: "absolute", top: y, left: r * (CARD_W + ROUND_GAP), width: CARD_W, height: CARD_H }}>
                    <div style={styles.matchCard}>
                      {[
                        { team: t1, id: m.team1_id },
                        { team: t2, id: m.team2_id },
                      ].map((slot, idx) => {
                        const isWinner = m.winner_id && slot.id === m.winner_id;
                        const isLoser = m.winner_id && slot.id && slot.id !== m.winner_id;
                        const isBye = !slot.team && !slot.id;
                        return (
                          <div
                            key={idx}
                            onClick={() => canDecide && slot.id && declareWinner(tournamentId, m, slot.id)}
                            style={{
                              height: "50%",
                              display: "flex",
                              cursor: canDecide && slot.id ? "pointer" : "default",
                              marginBottom: idx === 0 ? 2 : 0,
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                padding: "0 10px",
                                fontSize: 12.5,
                                fontWeight: isWinner ? 700 : 400,
                                background: isBye
                                  ? "#1C1315"
                                  : "repeating-linear-gradient(180deg, #7A2530, #7A2530 2px, #6E2129 2px, #6E2129 4px)",
                                borderLeft: isWinner ? "2px solid #E8A33D" : "2px solid transparent",
                                color: isLoser ? "#C9928F" : isWinner ? "#FFE8B8" : "#F8EFEE",
                                textDecoration: isLoser ? "line-through" : "none",
                              }}
                            >
                              {slot.team ? teamLabel(slot.team) : slot.id ? "…" : <span style={{ color: "#8C7876", fontStyle: "italic" }}>bye</span>}
                            </div>
                            <div
                              style={{
                                width: 44,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isWinner ? "#1E4A63" : "#173142",
                                borderLeft: "1px solid #0E2230",
                              }}
                            >
                              {isBye ? null : m.winner_id ? (
                                m.team1_score != null && m.team2_score != null ? (
                                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 15, lineHeight: 1, color: isWinner ? "#FFE8B8" : "#9FD4EE" }}>
                                    {idx === 0 ? m.team1_score : m.team2_score}
                                  </span>
                                ) : isWinner ? (
                                  <Check size={14} color="#7FCBEA" />
                                ) : null
                              ) : (
                                <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 15, lineHeight: 1, color: "#9FD4EE" }}>
                                  {idx === 0 ? "V" : "S"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        .nur-in::placeholder { color: #8C7876; }
        .nur-btn:disabled { opacity: .35; cursor: not-allowed; }
        .nur-bracket-scroll { scrollbar-width: thin; scrollbar-color: #3D2226 transparent; }
        .nur-bracket-scroll::-webkit-scrollbar { height: 6px; }
        .nur-bracket-scroll::-webkit-scrollbar-track { background: transparent; }
        .nur-bracket-scroll::-webkit-scrollbar-thumb { background: #3D2226; border-radius: 3px; }
        .nur-bracket-scroll::-webkit-scrollbar-thumb:hover { background: #5A2E33; }
        .nur-chat-scroll { scrollbar-width: thin; scrollbar-color: #3D2226 transparent; }
        .nur-chat-scroll::-webkit-scrollbar { width: 6px; }
        .nur-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .nur-chat-scroll::-webkit-scrollbar-thumb { background: linear-gradient(#5A2E33, #2E1B1E); border-radius: 3px; }
        .nur-chat-scroll::-webkit-scrollbar-thumb:hover { background: #7A3A40; }
        @keyframes nur-ticker-run {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .nur-ticker { animation: nur-ticker-run 26s linear infinite; }
        .nur-ticker:hover { animation-play-state: paused; }
        @media (max-width: 860px) {
          .nur-hero-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes nur-bell-blink {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 0px rgba(217,65,76,0)); }
          50% { opacity: 0.35; filter: drop-shadow(0 0 6px rgba(217,65,76,0.9)); }
        }
        .nur-bell-blink { animation: nur-bell-blink 1s ease-in-out infinite; }
        @keyframes nur-toast-in {
          0% { opacity: 0; transform: translateX(30px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .nur-volume-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(90deg, #5A0F14, #D9414C 55%, #E8A33D);
          outline: none;
          position: relative;
          z-index: 1;
        }
        .nur-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #FFFDF9, #F3ECEA 60%, #D9414C 130%);
          border: 2px solid #E8A33D;
          box-shadow: 0 0 10px rgba(217,65,76,0.7), 0 0 2px rgba(0,0,0,0.5);
          cursor: pointer;
        }
        .nur-volume-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #FFFDF9, #F3ECEA 60%, #D9414C 130%);
          border: 2px solid #E8A33D;
          box-shadow: 0 0 10px rgba(217,65,76,0.7);
          cursor: pointer;
        }
        .nur-volume-slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(90deg, #5A0F14, #D9414C 55%, #E8A33D);
        }
        .nur-mode-btn { background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); transition: background .25s ease, color .25s ease, border-color .25s ease, box-shadow .25s ease, transform .12s ease; }
        .nur-mode-btn:hover:not(.active) { background: linear-gradient(180deg, rgba(232,163,61,0.12), rgba(232,163,61,0.04)); border-color: #E8A33D; color: #E8A33D; }
        .nur-veto-card { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease, filter .2s ease; }
        .nur-veto-card.pickable:hover {
          transform: skewX(-7deg) translateY(-14px) scale(1.03) !important;
          border-color: #D9414C !important;
          box-shadow: 0 22px 46px rgba(0,0,0,0.7), 0 0 34px rgba(217,65,76,0.45) !important;
        }
        .nur-veto-bg-layer {
          position: absolute;
          inset: -40% -80%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 30px;
          pointer-events: none;
          user-select: none;
          transform: rotate(-6deg);
          will-change: transform;
          transition: transform 0.12s ease-out;
          z-index: 0;
        }
        .nur-veto-bg-row { display: flex; gap: 44px; white-space: nowrap; font-family: 'Anton', sans-serif; line-height: 1; }
        .nur-veto-bg-far .nur-veto-bg-row { font-size: 58px; }
        .nur-veto-bg-far { filter: blur(2.5px); opacity: 0.5; }
        .nur-veto-bg-far .nur-veto-bg-nur { color: rgba(255,255,255,0.035); }
        .nur-veto-bg-far .nur-veto-bg-tour { color: transparent; -webkit-text-stroke: 1px rgba(255,255,255,0.04); }
        .nur-veto-bg-mid .nur-veto-bg-row { font-size: 88px; }
        .nur-veto-bg-mid { filter: blur(1px); opacity: 0.85; }
        .nur-veto-bg-mid .nur-veto-bg-nur { color: rgba(255,255,255,0.055); }
        .nur-veto-bg-mid .nur-veto-bg-tour { color: transparent; -webkit-text-stroke: 1.4px rgba(255,255,255,0.06); }
        .nur-veto-bg-near .nur-veto-bg-row { font-size: 128px; gap: 60px; }
        .nur-veto-bg-near .nur-veto-bg-nur { color: rgba(255,255,255,0.045); }
        .nur-veto-bg-near .nur-veto-bg-tour { color: transparent; -webkit-text-stroke: 1.8px rgba(255,255,255,0.05); }
        @keyframes nur-veto-ban-shake {
          0% { transform: skewX(-7deg) translateX(0); }
          20% { transform: skewX(-7deg) translateX(-5px); }
          40% { transform: skewX(-7deg) translateX(5px); }
          60% { transform: skewX(-7deg) translateX(-3px); }
          80% { transform: skewX(-7deg) translateX(3px); }
          100% { transform: skewX(-7deg) translateX(0); }
        }
        @keyframes nur-veto-ban-sweep {
          from { transform: translateY(-110%); }
          to { transform: translateY(110%); }
        }
        @keyframes nur-veto-badge-stamp {
          0% { opacity: 0; transform: translate(-50%,-50%) skewX(7deg) scale(2.4) rotate(-16deg); }
          55% { opacity: 1; transform: translate(-50%,-50%) skewX(7deg) scale(0.92) rotate(3deg); }
          100% { opacity: 1; transform: translate(-50%,-50%) skewX(7deg) scale(1) rotate(0); }
        }
        @keyframes nur-veto-flash-out {
          0% { opacity: 0.85; }
          100% { opacity: 0; }
        }
        .nur-veto-card.banning { animation: nur-veto-ban-shake 0.45s ease; }
        .nur-veto-sweep {
          position: absolute; left: -20%; right: -20%; top: 0; height: 60%;
          background: linear-gradient(180deg, transparent, rgba(217,65,76,0.55), transparent);
          animation: nur-veto-ban-sweep 0.55s ease forwards;
          pointer-events: none;
        }
        .nur-veto-flash {
          position: absolute; inset: 0; background: #D9414C;
          animation: nur-veto-flash-out 0.5s ease forwards;
          pointer-events: none;
        }
        .nur-veto-badge-anim { animation: nur-veto-badge-stamp 0.5s cubic-bezier(0.2,1.4,0.4,1) both; }
        .nur-mode-btn:active { transform: scale(0.96); }
        @keyframes nur-mode-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .nur-mode-btn.active {
          background: linear-gradient(120deg, #D9414C 0%, #E8A33D 35%, #D9414C 70%, #E8A33D 100%);
          background-size: 300% 300%;
          animation: nur-mode-shimmer 3.2s ease infinite;
        }
        .nur-mode-smoke-field { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
        .nur-mode-puff2 {
          position: absolute;
          border-radius: 50%;
          filter: blur(22px);
          opacity: 0;
          mix-blend-mode: screen;
          animation: nur-mode-drift var(--dur) ease-out forwards;
          animation-delay: var(--delay);
        }
        @keyframes nur-mode-drift {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.25); }
          12%  { opacity: var(--peak); }
          100% { opacity: 0; transform: translate(var(--x1), var(--y1)) scale(var(--s1)); }
        }
        @keyframes nur-smoke-sweep {
          0%   { transform: translateX(-40%); opacity: 0; }
          8%   { opacity: 0.9; }
          45%  { opacity: 0.9; }
          52%  { transform: translateX(220%); opacity: 0; }
          100% { transform: translateX(220%); opacity: 0; }
        }
        .nur-smoke {
          position: absolute;
          top: 0;
          left: 0;
          width: 45%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 70% 90% at 30% 50%, rgba(217,65,76,0.55), transparent 65%),
            radial-gradient(ellipse 55% 70% at 70% 40%, rgba(232,163,61,0.30), transparent 60%);
          filter: blur(24px);
          animation: nur-smoke-sweep 4.6s ease-in-out infinite;
        }
        @keyframes nur-menu-smoke {
          0%   { transform: translate(-6%, 0%) rotate(0deg) scale(1); opacity: 0.5; }
          33%  { transform: translate(5%, -6%) rotate(4deg) scale(1.15); opacity: 0.75; }
          66%  { transform: translate(-3%, 5%) rotate(-3deg) scale(1.05); opacity: 0.6; }
          100% { transform: translate(-6%, 0%) rotate(0deg) scale(1); opacity: 0.5; }
        }
        .nur-menu-smoke {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(217,65,76,0.55), transparent 60%),
            radial-gradient(ellipse 55% 45% at 80% 30%, rgba(232,163,61,0.35), transparent 60%),
            radial-gradient(ellipse 70% 60% at 50% 90%, rgba(217,65,76,0.30), transparent 65%);
          filter: blur(22px);
          animation: nur-menu-smoke 9s ease-in-out infinite;
        }
      `}</style>

      <div style={{ ...styles.nav, position: "relative" }} onCopy={(e) => e.preventDefault()}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
          <div className="nur-smoke" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => {
              setActiveTab("tournaments");
              setViewingUser(null);
              setNavMenuOpen(false);
            }}
          >
            <img src={logoImg} alt="NUR" style={styles.logoImg} />
            <span style={styles.logo}>
              NUR <span style={{ color: "#D9414C" }}>TOURNAMENTS</span>
            </span>
          </div>
          {[
            { key: "tournaments", label: "Главная" },
            { key: "matches", label: "Матчи" },
            { key: "teams", label: "Команды" },
            { key: "tourlist", label: "Турниры" },
            { key: "lfg", label: "Тиммейты" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                setViewingUser(null);
                setNavMenuOpen(false);
                if (t.key === "lfg") refreshLfgPosts();
              }}
              style={{ ...styles.tabBtn, ...(activeTab === t.key ? styles.tabBtnActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>

          {!session ? (
            <>
              <div style={styles.rulesBtn} title="Правила сайта" onClick={() => setShowRulesModal(true)}>
                <ScrollText size={15} color="#6E5F5D" />
              </div>
              <button
                className="nur-btn"
                style={styles.accentBtnSm}
                onClick={() => {
                  setActiveTab("profile");
                  setNavMenuOpen(false);
                }}
              >
                <LogIn size={13} /> Войти
              </button>
            </>
          ) : (
            <div ref={navAreaRef} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={styles.rulesBtn} title="Правила сайта" onClick={() => setShowRulesModal(true)}>
                <ScrollText size={15} color="#6E5F5D" />
              </div>
              <div style={{ position: "relative" }}>
                <div
                  style={styles.bellBtn}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNavMenuOpen(false);
                    setNotifOpen(!notifOpen);
                  }}
                >
                  <Bell
                    size={16}
                    color={Object.values(unreadCounts).some((c) => c > 0) ? "#D9414C" : "#AE9B99"}
                    className={Object.values(unreadCounts).some((c) => c > 0) ? "nur-bell-blink" : ""}
                  />
                  {(incomingRequests.length > 0 || teamInvites.length > 0 || Object.values(unreadCounts).some((c) => c > 0)) && (
                    <span style={styles.notifyDot} />
                  )}
                </div>
                {notifOpen && (
                  <div style={{ ...styles.navDropdown, width: 280 }}>
                    <div style={{ position: "relative", zIndex: 1 }}>
                      {Object.entries(unreadCounts).some(([, c]) => c > 0) && (
                        <>
                          <div style={{ padding: "2px 4px 8px", color: "#8C7876", fontSize: 11 }}>Сообщения</div>
                          {Object.entries(unreadCounts)
                            .filter(([, c]) => c > 0)
                            .map(([senderId, count]) => {
                              const sender = friends.find((f) => f.id === senderId);
                              if (!sender) return null;
                              return (
                                <div
                                  key={senderId}
                                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", cursor: "pointer" }}
                                  onClick={() => {
                                    setNotifOpen(false);
                                    openChat(sender);
                                  }}
                                >
                                  <div style={styles.avatarWrapSm}>
                                    {sender.avatar_url ? (
                                      <img src={sender.avatar_url} alt="" style={styles.avatarImgSm} />
                                    ) : (
                                      <div style={styles.avatarFallbackSm}>{(sender.username || "?")[0].toUpperCase()}</div>
                                    )}
                                  </div>
                                  <span style={{ flex: 1, fontSize: 12.5, color: "#F3ECEA" }}>{sender.username}</span>
                                  <span style={{ background: "#D9414C", color: "#fff", fontSize: 10.5, borderRadius: 9, padding: "1px 7px" }}>{count}</span>
                                </div>
                              );
                            })}
                          <div style={{ height: 1, background: "#3D2226", margin: "8px 0" }} />
                        </>
                      )}
                      <div style={{ padding: "2px 4px 8px", color: "#8C7876", fontSize: 11 }}>Заявки в друзья</div>
                      {incomingRequests.length === 0 && <div style={{ ...styles.hint, padding: "4px 4px 6px" }}>Новых заявок нет.</div>}
                      {incomingRequests.map((r) => (
                        <div key={r.requestId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                          <div style={styles.avatarWrapSm}>
                            {r.avatar_url ? (
                              <img src={r.avatar_url} alt="" style={styles.avatarImgSm} />
                            ) : (
                              <div style={styles.avatarFallbackSm}>{(r.username || "?")[0].toUpperCase()}</div>
                            )}
                          </div>
                          <span style={{ flex: 1, fontSize: 12.5, color: "#F3ECEA" }}>{r.username}</span>
                          <button
                            style={styles.iconBtn}
                            onClick={() => {
                              acceptFriendRequest(r.requestId);
                            }}
                          >
                            <Check size={13} color="#6FBF73" />
                          </button>
                          <button
                            style={styles.iconBtn}
                            onClick={() => {
                              removeFriend(r.requestId);
                            }}
                          >
                            <X size={13} color="#FF5A5A" />
                          </button>
                        </div>
                      ))}

                      <div style={{ height: 1, background: "#3D2226", margin: "8px 0" }} />
                      <div style={{ padding: "2px 4px 8px", color: "#8C7876", fontSize: 11 }}>Приглашения в команды</div>
                      {teamInvites.length === 0 && <div style={{ ...styles.hint, padding: "4px 4px 6px" }}>Новых приглашений нет.</div>}
                      {teamInvites.map((inv) => (
                        <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                          <ShieldPlus size={15} color="#E8A33D" />
                          <span style={{ flex: 1, fontSize: 12.5, color: "#F3ECEA" }}>{teamLabel(inv.team)}</span>
                          <button style={styles.iconBtn} onClick={() => acceptTeamInvite(inv)}>
                            <Check size={13} color="#6FBF73" />
                          </button>
                          <button style={styles.iconBtn} onClick={() => declineTeamInvite(inv.id)}>
                            <X size={13} color="#FF5A5A" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div ref={avatarPillRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "#1C1416",
                    border: "1px solid #3D2226",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNavMenuOpen(false);
                    setNotifOpen(false);
                    openUserProfile({ id: session.user.id });
                  }}
                >
                  <div style={styles.avatarWrapPill}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" style={styles.avatarImgPill} />
                    ) : (
                      <div style={styles.avatarFallbackPill}>{(currentUsername || "?")[0].toUpperCase()}</div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#1C1416",
                    border: "1px solid #3D2226",
                    borderRadius: 20,
                    padding: "8px 14px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotifOpen(false);
                    setNavMenuOpen(!navMenuOpen);
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "#F3ECEA" }}>{currentUsername}</span>
                  <ChevronDown
                    size={13}
                    color="#AE9B99"
                    style={{
                      transform: navMenuOpen ? "rotate(0deg)" : "rotate(180deg)",
                      transition: "transform 0.25s ease",
                    }}
                  />
                </div>

              <div
                ref={navPanelRef}
                style={{
                  ...styles.navPanel,
                  transform: navMenuOpen ? "translateX(0)" : "translateX(100%)",
                  transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
                  pointerEvents: navMenuOpen ? "auto" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="nur-menu-smoke" style={{ opacity: 0.5 }} />
                    <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #2A1B1D" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button style={styles.iconBtn} onClick={() => setNavMenuOpen(false)}>
                            <X size={16} color="#AE9B99" />
                          </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                          <div style={styles.avatarWrapMenu}>
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="" style={styles.avatarImgMenu} />
                            ) : (
                              <div style={styles.avatarFallbackMenu}>{(currentUsername || "?")[0].toUpperCase()}</div>
                            )}
                          </div>
                          <div>
                            <div style={{ color: "#F3ECEA", fontFamily: "'Anton', sans-serif", fontSize: 17, letterSpacing: 0.3 }}>{currentUsername}</div>
                            <div style={{ color: "#AE9B99", fontSize: 11.5, marginTop: 2 }}>
                              {teams.filter((t) => t.owner_id === session.user.id).length} команд
                              {incomingRequests.length > 0 ? ` · ${incomingRequests.length} заявка в друзья` : ""}
                            </div>
                          </div>
                        </div>
                        <button
                          className="nur-btn"
                          style={{ ...styles.accentBtnSm, width: "100%", justifyContent: "center", marginTop: 14 }}
                          onClick={() => {
                            setActiveTab("teams");
                            setViewingUser(null);
                            openCreateTeam();
                            setNavMenuOpen(false);
                          }}
                        >
                          <ShieldPlus size={13} /> Создать команду
                        </button>
                      </div>

                      <div style={{ padding: "10px 10px 6px" }}>
                        <button
                          style={styles.navDropdownItem}
                          onClick={() => {
                            setActiveTab("profile");
                            setViewingUser(null);
                            setNavMenuOpen(false);
                          }}
                        >
                          <UserIcon size={15} color="#D9414C" /> Профиль
                        </button>
                        <button
                          style={styles.navDropdownItem}
                          onClick={() => {
                            setActiveTab("teams");
                            setViewingUser(null);
                            setNavMenuOpen(false);
                          }}
                        >
                          <Users size={15} color="#D9414C" /> Мои команды
                        </button>
                        <button
                          style={{ ...styles.navDropdownItem, position: "relative" }}
                          onClick={() => {
                            setActiveTab("dialogs");
                            setViewingUser(null);
                            setNavMenuOpen(false);
                          }}
                        >
                          <MessageCircle size={15} color="#D9414C" /> Диалоги
                          {Object.values(unreadCounts).some((n) => n > 0) && <span style={{ ...styles.notifyDot, position: "static", marginLeft: 4 }} />}
                        </button>
                        {(profile?.is_admin || profile?.is_moderator) && (
                          <button
                            style={styles.navDropdownItem}
                            onClick={() => {
                              setActiveTab("support");
                              setViewingUser(null);
                              refreshSupportTickets();
                              refreshSupportArchive();
                              setNavMenuOpen(false);
                            }}
                          >
                            <LifeBuoy size={15} color="#D9414C" /> Поддержка
                          </button>
                        )}
                        {profile?.is_admin && (
                          <button
                            style={styles.navDropdownItem}
                            onClick={() => {
                              setActiveTab("admin");
                              setViewingUser(null);
                              setNavMenuOpen(false);
                            }}
                          >
                            <Settings size={15} color="#D9414C" /> Админ-панель
                          </button>
                        )}
                      </div>

                      <div style={{ padding: "10px 16px 8px", color: "#8C7876", fontSize: 11.5, letterSpacing: 0.5, textTransform: "uppercase", borderTop: "1px solid #2A1B1D" }}>
                        Друзья · {friends.filter((f) => onlineUserIds.has(f.id)).length} из {friends.length} онлайн
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px" }}>
                        {friends.length === 0 && <div style={{ ...styles.hint, padding: "8px 6px" }}>Пока никого не добавили.</div>}
                        {friends.map((f) => (
                          <div key={f.requestId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px" }}>
                            <div
                              style={{ ...styles.avatarWrapSm, cursor: "pointer", position: "relative" }}
                              onClick={() => {
                                setNavMenuOpen(false);
                                openUserProfile(f);
                              }}
                            >
                              {f.avatar_url ? (
                                <img src={f.avatar_url} alt="" style={styles.avatarImgSm} />
                              ) : (
                                <div style={styles.avatarFallbackSm}>{(f.username || "?")[0].toUpperCase()}</div>
                              )}
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: -1,
                                  right: -1,
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  border: "2px solid #150F10",
                                  background: onlineUserIds.has(f.id) ? "#6FBF73" : "#5A2E33",
                                }}
                              />
                            </div>
                            <span
                              style={{ color: "#F3ECEA", fontSize: 13, flex: 1, cursor: "pointer", userSelect: "none" }}
                              onClick={() => {
                                setNavMenuOpen(false);
                                openUserProfile(f);
                              }}
                            >
                              {f.username}
                            </span>
                            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => openChat(f)}>
                              <MessageCircle size={15} color="#E8A33D" />
                              {unreadCounts[f.id] > 0 && <span style={styles.notifyDot} />}
                            </div>
                            <div
                              style={{ cursor: "pointer" }}
                              title={mutedUserIds.has(f.id) ? "Убрать из мута" : "Замьютить"}
                              onClick={() => (mutedUserIds.has(f.id) ? unmuteUser(f.id) : muteUser(f.id))}
                            >
                              {mutedUserIds.has(f.id) ? <BellOff size={14} color="#7A6668" /> : <Bell size={14} color="#5A4548" />}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: 10, borderTop: "1px solid #2A1B1D" }}>
                        <button
                          style={{ ...styles.navDropdownItem, color: "#FF8A8A" }}
                          onClick={() => {
                            doLogout();
                            setNavMenuOpen(false);
                          }}
                        >
                          <LogOut size={15} /> Выйти
                        </button>
                      </div>
                    </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.body}>
        {errorMsg && (
          <div style={styles.errorNote}>
            <ShieldAlert size={13} /> {errorMsg}
          </div>
        )}

        {!viewingUser && (
        <>
        {(activeTab === "tournaments" || activeTab === "tourlist") && (
          <>
          {/* Шапка, лента и лестница — только на Главной. Вкладка «Турниры»
              показывает тот же список турниров без верхних блоков. */}
          {activeTab === "tournaments" && (
          <>
          {/* ================= ШАПКА + ОБРАТНЫЙ ОТСЧЁТ ================= */}
          <div className="nur-hero-grid" style={styles.heroGrid}>
            <div style={styles.hero}>
              <div style={styles.heroStreak} />
              <div style={styles.heroGhost}>NUR</div>
              <div style={styles.heroBadge}><span style={styles.unskew}>● Приём заявок открыт</span></div>
              <div style={styles.heroTitle}>
                СОБЕРИ СОСТАВ.
                <br />
                <span style={styles.heroTitleAccent}>ЗАБЕРИ ТИТУЛ.</span>
              </div>
              <div style={styles.heroText}>
                Турниры по CS2 в форматах 5×5 и 2×2. Олимпийская сетка, бан карт между капитанами, автоматическая выдача серверов.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <button className="nur-btn" style={styles.heroBtnPrimary} onClick={() => setActiveTab("teams")}>
                  <span style={styles.unskew}>Создать команду</span>
                </button>
                <a href="https://t.me/tourNUR" target="_blank" rel="noopener noreferrer" className="nur-btn" style={styles.heroBtnGhost}>
                  <span style={styles.unskew}>Telegram</span>
                </a>
              </div>
            </div>

            <div style={styles.heroSide}>
              {countdownParts ? (
                <>
                  <div style={styles.heroSideLabel}>До старта турнира</div>
                  <div style={styles.cdRow}>
                    {countdownParts.d > 0 && (
                      <>
                        <span style={styles.cdNum}>{pad2(countdownParts.d)}</span>
                        <span style={styles.cdUnit}>д</span>
                      </>
                    )}
                    <span style={styles.cdNum}>{pad2(countdownParts.h)}</span>
                    <span style={styles.cdUnit}>ч</span>
                    <span style={styles.cdNum}>{pad2(countdownParts.mi)}</span>
                    <span style={styles.cdUnit}>м</span>
                    <span style={{ ...styles.cdNum, color: "#6A4B4E" }}>{pad2(countdownParts.s)}</span>
                    <span style={styles.cdUnit}>с</span>
                  </div>
                  {nextMatch ? (
                    <>
                      <div style={styles.vsRow}>
                        <div style={styles.vsPanel}>
                          <span style={styles.vsTeam}>{shortTeamName(teamMap[nextMatch.team1_id])}</span>
                        </div>
                        <span style={styles.vsLabel}>VS</span>
                        <div style={styles.vsPanel}>
                          <span style={{ ...styles.vsTeam, textAlign: "right" }}>{shortTeamName(teamMap[nextMatch.team2_id])}</span>
                        </div>
                      </div>
                      <div style={styles.cdTourMeta}>
                        {upcomingTour.name} · {nextMatchLabel}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.cdTourName}>{upcomingTour.name}</div>
                      <div style={styles.cdTourMeta}>
                        {MODE_LABEL[upcomingTour.mode]} · {formatDateTime(upcomingTour.start_at)}
                      </div>
                    </>
                  )}
                </>
              ) : featuredTour ? (
                <>
                  <div style={styles.heroSideLabel}>Турнир идёт</div>
                  <div style={{ ...styles.cdTourName, fontSize: 26, marginTop: 10 }}>{featuredTour.name}</div>
                  <div style={styles.cdTourMeta}>
                    {MODE_LABEL[featuredTour.mode]} · стадия {featuredStageLabel}
                  </div>
                  {nextMatch && (
                    <div style={styles.vsRow}>
                      <div style={styles.vsPanel}>
                        <span style={styles.vsTeam}>{shortTeamName(teamMap[nextMatch.team1_id])}</span>
                      </div>
                      <span style={styles.vsLabel}>VS</span>
                      <div style={styles.vsPanel}>
                        <span style={{ ...styles.vsTeam, textAlign: "right" }}>{shortTeamName(teamMap[nextMatch.team2_id])}</span>
                      </div>
                    </div>
                  )}
                  <button className="nur-btn" style={{ ...styles.accentBtnSm, marginTop: 16, alignSelf: "flex-start" }} onClick={() => toggleExpand(featuredTour.id, true)}>
                    Смотреть сетку
                  </button>
                </>
              ) : registrationTour ? (
                <>
                  <div style={styles.heroSideLabel}>Идёт регистрация</div>
                  <div style={{ ...styles.cdTourName, fontSize: 24, marginTop: 10 }}>{registrationTour.name}</div>
                  <div style={styles.cdTourMeta}>
                    {MODE_LABEL[registrationTour.mode]}
                    {registrationTour.prize_pool ? ` · ${registrationTour.prize_pool}` : ""}
                  </div>
                  <div style={styles.regProgressRow}>
                    <span style={styles.regProgressNum}>
                      {registrationCount}
                      {registrationCap ? <span style={{ color: "#6A4B4E" }}>{` / ${registrationCap}`}</span> : null}
                    </span>
                    <span style={styles.regProgressWord}>команд заявлено</span>
                  </div>
                  {registrationCap ? (
                    <div style={styles.regTrack}>
                      <div
                        style={{
                          ...styles.regFill,
                          width: `${Math.min(100, Math.round((registrationCount / registrationCap) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                  <button
                    className="nur-btn"
                    style={{ ...styles.accentBtnSm, marginTop: 16, alignSelf: "flex-start" }}
                    onClick={() => setActiveTab("teams")}
                  >
                    Заявить команду
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.heroSideLabel}>Ближайший турнир</div>
                  <div style={{ ...styles.cdTourName, fontSize: 22, marginTop: 10 }}>Дата пока не назначена</div>
                  <div style={styles.cdTourMeta}>Анонсы выходят в Telegram-канале</div>
                  <a
                    href="https://t.me/tourNUR"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nur-btn"
                    style={{ ...styles.ghostBtnSm, textDecoration: "none", marginTop: 16, display: "inline-flex", alignSelf: "flex-start" }}
                  >
                    Открыть канал
                  </a>
                </>
              )}
            </div>
          </div>

          {/* ================= БЕГУЩАЯ СТРОКА РЕЗУЛЬТАТОВ ================= */}
          {recentResults.length > 0 && (
            <div style={styles.tickerWrap}>
              <div className="nur-ticker" style={styles.tickerTrack}>
                {[0, 1].map((copy) => (
                  <div key={copy} style={styles.tickerGroup}>
                    {recentResults.map((m) => (
                      <span key={`${copy}-${m.id}`} style={styles.tickerItem}>
                        {shortTeamName(teamMap[m.team1_id])}
                        <b style={{ margin: "0 6px" }}>
                          {m.team1_score} : {m.team2_score}
                        </b>
                        {shortTeamName(teamMap[m.team2_id])}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= СТАТИСТИКА ================= */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statNum}>{teams.length}</div>
              <div style={styles.statLabel}>команд</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNum}>{allMatches.length}</div>
              <div style={styles.statLabel}>матчей сыграно</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNum}>{tournaments.length}</div>
              <div style={styles.statLabel}>турниров</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNum, color: liveLobbies.length ? "#8BC34A" : "#F3ECEA" }}>{liveLobbies.length}</div>
              <div style={styles.statLabel}>идут сейчас</div>
            </div>
          </div>

          {/* ================= 01 — В ЭФИРЕ ================= */}
          {(liveLobbies.length > 0 || recentResults.length > 0) && (
            <div style={{ marginTop: 30 }}>
              <div style={styles.secHead}>
                <span style={styles.secNum}>01</span>
                <span style={styles.secTitle}>В эфире</span>
                <span style={styles.secRail} />
              </div>
              <div style={styles.liveGrid}>
                {liveLobbies.map((l) => (
                  <div key={l.id} style={{ ...styles.homeMatchCard, borderColor: "#5A2E33", background: "#140E10" }}>
                    <div style={styles.matchCardTop}>
                      <span style={styles.liveTag}>● LIVE</span>
                      <span style={styles.matchMap}>{MAP_LABEL[l.map] || l.map || "—"}</span>
                    </div>
                    <div style={styles.matchRow}>
                      <div style={styles.matchSideL}>
                        <span style={{ ...styles.matchTeam, ...styles.unskew }}>{shortTeamName(teamMap[l.team1_id])}</span>
                      </div>
                      <span style={styles.matchVs}>VS</span>
                      <div style={styles.matchSideR}>
                        <span style={{ ...styles.matchTeam, ...styles.unskew, textAlign: "right" }}>{shortTeamName(teamMap[l.team2_id])}</span>
                      </div>
                    </div>
                    <div style={styles.matchFoot}>{l.status === "started" ? "матч идёт на сервере" : "сервер готов, игроки заходят"}</div>
                  </div>
                ))}

                {recentResults.slice(0, Math.max(2, 4 - liveLobbies.length)).map((m) => {
                  const t1Won = m.winner_id === m.team1_id;
                  return (
                    <div key={m.id} style={styles.homeMatchCard}>
                      <div style={styles.matchCardTop}>
                        <span style={styles.doneTag}>ЗАВЕРШЁН</span>
                        <span style={styles.matchMap}>{tourById[m.tournament_id]?.name || ""}</span>
                      </div>
                      <div style={styles.matchRow}>
                        <div style={{ ...styles.matchSideL, borderLeft: t1Won ? "3px solid #E8A33D" : "3px solid transparent" }}>
                          <span style={{ ...styles.matchTeam, ...styles.unskew, color: t1Won ? "#F3ECEA" : "#8C7876" }}>{shortTeamName(teamMap[m.team1_id])}</span>
                        </div>
                        <span style={styles.matchScore}>
                          <span style={{ color: t1Won ? "#E8A33D" : "#8C7876" }}>{m.team1_score}</span>
                          <span style={{ color: "#5A4548", margin: "0 3px" }}>:</span>
                          <span style={{ color: !t1Won ? "#E8A33D" : "#8C7876" }}>{m.team2_score}</span>
                        </span>
                        <div style={{ ...styles.matchSideR, borderRight: !t1Won ? "3px solid #E8A33D" : "3px solid transparent" }}>
                          <span style={{ ...styles.matchTeam, ...styles.unskew, textAlign: "right", color: !t1Won ? "#F3ECEA" : "#8C7876" }}>
                            {shortTeamName(teamMap[m.team2_id])}
                          </span>
                        </div>
                      </div>
                      <div style={styles.matchFoot}>{roundLabelShort(m.round, (buildRounds(m.tournament_id) || []).length || m.round + 1)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 02 — ЛЕСТНИЦА ================= */}
          <div style={{ marginTop: 34 }}>
            <div style={styles.secHead}>
              <span style={styles.secNum}>{secNoLadder}</span>
              <span style={styles.secTitle}>Лестница</span>
              <span style={styles.secRail} />
              <div style={styles.pillGroup}>
                {["5x5", "2x2"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setLeaderboardMode(m)}
                    style={{ ...styles.pillBtn, ...(leaderboardMode === m ? styles.pillBtnActive : {}) }}
                  >
                    <span style={{ display: "inline-block", transform: "skewX(9deg)" }}>{MODE_LABEL[m]}</span>
                  </button>
                ))}
              </div>
            </div>

            {homeLadder.length === 0 ? (
              <div style={styles.emptyStateBox}>
                <Trophy size={26} color="#4A2C2F" />
                <div style={styles.emptyStateTitle}>Рейтинг пока пуст</div>
                <div style={styles.emptyStateText}>Как только команды сыграют первые матчи, здесь появится таблица.</div>
              </div>
            ) : (
              <>
                <div style={styles.ladderHead}>
                  <span style={{ width: 34 }} />
                  <span style={{ flex: 1 }}>КОМАНДА</span>
                  <span style={{ width: 86 }}>В / П</span>
                  <span style={{ width: 152 }}>ВИНРЕЙТ</span>
                  <span style={{ width: 46, textAlign: "right" }}>ОЧКИ</span>
                </div>
                {homeLadder.map((row, i) => {
                  const top = i === 0;
                  return (
                    <div key={row.id} style={{ ...styles.ladderRow, ...(top ? styles.ladderRowTop : {}) }}>
                      <span style={styles.ladderGhostNum}>{i + 1}</span>
                      <span style={{ ...styles.ladderPos, ...(top ? styles.ladderPosTop : {}) }}>{i + 1}</span>
                      <div style={styles.ladderLogo}>
                        {row.team?.logo_url ? (
                          <img src={row.team.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 13, color: top ? "#E8A33D" : "#8C7876" }}>
                            {(row.team?.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                        <div style={styles.ladderName}>{teamLabel(row.team)}</div>
                        <div style={styles.ladderSub}>
                          {top && row.titles > 0 ? (
                            <span style={{ color: "#E8A33D" }}>ДЕЙСТВУЮЩИЙ ЧЕМПИОН · </span>
                          ) : null}
                          {row.played} {row.played === 1 ? "МАТЧ" : row.played < 5 ? "МАТЧА" : "МАТЧЕЙ"}
                          {row.titles > 0 ? ` · ${row.titles} 🏆` : ""}
                        </div>
                      </div>
                      <div style={{ width: 86, flexShrink: 0, display: "flex", gap: 5, position: "relative" }}>
                        <span style={styles.winBadge}>{row.wins}В</span>
                        <span style={styles.lossBadge}>{row.losses}П</span>
                      </div>
                      <div style={{ width: 152, flexShrink: 0, display: "flex", alignItems: "center", gap: 9, position: "relative" }}>
                        <div style={styles.wrTrack}>
                          <div style={{ ...styles.wrFill, width: `${row.wr}%`, background: top ? "#E8A33D" : "#8C7876" }} />
                        </div>
                        <span style={{ ...styles.wrPct, color: top ? "#E8A33D" : "#F3ECEA" }}>{row.wr}%</span>
                      </div>
                      <span style={{ ...styles.ladderPts, color: top ? "#E8A33D" : "#F3ECEA" }}>{row.points}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          </>
          )}

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", marginTop: 26 }}>
          <div style={{ ...styles.stack, flex: "1 1 480px", minWidth: 0 }}>
            <a href="https://t.me/tourNUR" target="_blank" rel="noopener noreferrer" style={styles.promoBanner}>
              <img src={promoImg} alt="NUR FAST CUP" style={styles.promoImg} />
              <div style={styles.promoText}>
                <div style={styles.promoTitle}>
                  <Megaphone size={14} color="#D9414C" /> Актуальный турнир анонсирован в Telegram
                </div>
                <div style={styles.promoSub}>Все новости, объявления и регистрация команд — в канале. Нажми, чтобы перейти →</div>
              </div>
            </a>

            <div style={styles.secHead}>
              <span style={styles.secNum}>{secNoTours}</span>
              <span style={styles.secTitle}>Турниры</span>
              <span style={styles.secRail} />
            </div>

            {tourList.length === 0 && (
              <div style={styles.emptyStateBox}>
                <Trophy size={26} color="#4A2C2F" />
                <div style={styles.emptyStateTitle}>Турниров пока нет</div>
                <div style={styles.emptyStateText}>Подпишись на Telegram-канал, чтобы не пропустить анонс следующего.</div>
                <a href="https://t.me/tourNUR" target="_blank" rel="noopener noreferrer" className="nur-btn" style={{ ...styles.ghostBtnSm, textDecoration: "none", marginTop: 14 }}>
                  Открыть канал
                </a>
              </div>
            )}

            {tourList.map((tour) => {
              const registeredIds = (tour.tournament_teams || []).map((tt) => tt.team_id);
              const registeredTeams = registeredIds.map((id) => teamMap[id]).filter(Boolean);
              const eligibleTeams = session
                ? teams.filter((t) => t.mode === tour.mode && t.owner_id === session.user.id && !registeredIds.includes(t.id))
                : [];
              const isFull = tour.max_teams ? registeredTeams.length >= tour.max_teams : false;
              const isExpanded = expandedTour === tour.id;
              const finalRound = isExpanded && expandedRounds ? expandedRounds[expandedRounds.length - 1] : null;
              const champion = tour.status === "finished" && finalRound && finalRound[0] ? teamMap[finalRound[0].winner_id] : null;

              return (
                <div key={tour.id} style={{ ...styles.card, padding: tour.banner_url ? 0 : 18, overflow: "hidden" }}>
                  {tour.banner_url && <img src={tour.banner_url} alt={tour.name} style={styles.tourBanner} />}
                  <div style={{ padding: tour.banner_url ? 18 : 0 }}>
                    <div style={styles.cardHeadRow}>
                      <div style={styles.tourThumb}>
                        <span style={styles.tourThumbText}>
                          {(tour.name || "NUR").replace(/[^A-Za-zА-Яа-я0-9 ]/g, "").split(" ").slice(0, 2).join(" ").toUpperCase().slice(0, 12) || "NUR"}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ ...styles.tourCardTitle, cursor: tour.status !== "registration" ? "pointer" : "default" }}
                          onClick={() => tour.status !== "registration" && toggleExpand(tour.id, true)}
                        >
                          {tour.name}
                        </div>
                        <div style={styles.chipRow}>
                          <span
                            style={{
                              ...styles.tchip,
                              ...(tour.status === "live" ? styles.tchipLive : {}),
                            }}
                          >
                            {tour.status === "live" ? "● " : ""}
                            {STATUS_LABEL[tour.status]}
                          </span>
                          <span style={styles.tchip}>{MODE_LABEL[tour.mode]}</span>
                          <span style={styles.tchip}>
                            {registeredTeams.length}
                            {tour.max_teams ? ` / ${tour.max_teams}` : ""} команд
                          </span>
                          {tour.prize_pool && <span style={{ ...styles.tchip, ...styles.tchipGold }}>Приз: {tour.prize_pool}</span>}
                          {tour.start_at && <span style={styles.tchip}>Старт: {formatDateTime(tour.start_at)}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {tour.status === "bracket_ready" && (profile?.is_admin || profile?.is_moderator) && (
                          <button className="nur-btn" style={{ ...styles.tourGoBtn, background: "#E8A33D", color: "#2C1B06" }} onClick={() => startTournament(tour.id)}>
                            Начать турнир
                          </button>
                        )}
                        {tour.status !== "registration" && (
                          <button className="nur-btn" style={styles.tourGoBtn} onClick={() => toggleExpand(tour.id, true)}>
                            Смотреть сетку
                          </button>
                        )}
                      </div>
                    </div>

                    {(tour.announce_at || tour.reg_open_at) && (
                      <div style={styles.scheduleRow}>
                        {tour.announce_at && <span>Анонс: {formatDateTime(tour.announce_at)}</span>}
                        {tour.reg_open_at && <span>Регистрация: {formatDateTime(tour.reg_open_at)}</span>}
                      </div>
                    )}

                    {registeredTeams.length > 0 && (
                      <>
                        <button
                          className="nur-btn"
                          style={{ ...styles.ghostBtnSm, marginTop: 10 }}
                          onClick={() => setShowTeamsTour(showTeamsTour === tour.id ? null : tour.id)}
                        >
                          {showTeamsTour === tour.id ? "Скрыть команды" : "Показать команды"}
                        </button>
                        {showTeamsTour === tour.id && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                            {registeredTeams.map((t) => (
                              <div key={t.id}>
                                <span
                                  style={{ ...styles.memberChip, cursor: "pointer" }}
                                  onClick={() => setExpandedTeamId(expandedTeamId === t.id ? null : t.id)}
                                >
                                  {teamLabel(t)}
                                </span>
                                {expandedTeamId === t.id && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, paddingLeft: 12 }}>
                                    {(t.team_members || []).map((m, i) => (
                                      <span key={i} style={{ ...styles.memberChip, color: "#AE9B99" }}>
                                        {m.member_name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* ---- Живая мини-сетка прямо в карточке турнира ---- */}
                    {(() => {
                      const rounds = buildRounds(tour.id);
                      if (!rounds.length) return null;
                      const total = rounds.length;
                      const playedCnt = allBracketMatches.filter((m) => m.tournament_id === tour.id && m.winner_id).length;
                      const totalCnt = allBracketMatches.filter((m) => m.tournament_id === tour.id).length;
                      const stage = (() => {
                        for (let i = 0; i < total; i++) {
                          if (rounds[i].some((m) => m && m.team1_id && m.team2_id && !m.winner_id)) return roundLabelShort(i, total);
                        }
                        return roundLabelShort(total - 1, total);
                      })();
                      return (
                        <>
                          <div style={styles.tourStatStrip}>
                            <div style={styles.tourStatCell}>
                              <div style={styles.tourStatLabel}>КОМАНД</div>
                              <div style={styles.tourStatVal}>
                                {registeredTeams.length}
                                {tour.max_teams ? ` / ${tour.max_teams}` : ""}
                              </div>
                            </div>
                            <div style={styles.tourStatCell}>
                              <div style={styles.tourStatLabel}>СТАДИЯ</div>
                              <div style={{ ...styles.tourStatVal, color: "#E8A33D" }}>{stage}</div>
                            </div>
                            <div style={styles.tourStatCell}>
                              <div style={styles.tourStatLabel}>СЫГРАНО</div>
                              <div style={styles.tourStatVal}>
                                {playedCnt} / {totalCnt}
                              </div>
                            </div>
                            <div style={{ ...styles.tourStatCell, borderRight: "none" }}>
                              <div style={styles.tourStatLabel}>ПРИЗ</div>
                              <div style={{ ...styles.tourStatVal, color: "#E8A33D" }}>{tour.prize_pool || "—"}</div>
                            </div>
                          </div>

                          <div className="nur-bracket-scroll" style={styles.miniBracketWrap}>
                            {rounds.map((round, ri) => (
                              <div key={ri} style={styles.miniCol}>
                                <div style={styles.miniColLabel}>{roundLabelShort(ri, total)}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "space-around", flex: 1 }}>
                                  {round.map((m, mi) => {
                                    if (!m) return <div key={mi} style={{ ...styles.miniMatch, opacity: 0.35 }} />;
                                    const decided = !!m.winner_id;
                                    const bothIn = !!(m.team1_id && m.team2_id);
                                    const t1Won = decided && m.winner_id === m.team1_id;
                                    const accent = decided ? "#E8A33D" : bothIn ? "#D9414C" : "#2E1B1E";
                                    return (
                                      <div key={m.id || mi} style={{ ...styles.miniMatch, borderLeftColor: accent }}>
                                        <div style={styles.miniSlot}>
                                          <span style={{ ...styles.miniTeam, color: decided && !t1Won ? "#7A6668" : "#F3ECEA" }}>
                                            {m.team1_id ? shortTeamName(teamMap[m.team1_id]) : "—"}
                                          </span>
                                          <span style={{ ...styles.miniScore, color: t1Won ? "#E8A33D" : "#7A6668" }}>
                                            {m.team1_score != null ? m.team1_score : decided ? "" : ""}
                                          </span>
                                        </div>
                                        <div style={styles.miniSlot}>
                                          <span style={{ ...styles.miniTeam, color: decided && t1Won ? "#7A6668" : "#F3ECEA" }}>
                                            {m.team2_id ? shortTeamName(teamMap[m.team2_id]) : "—"}
                                          </span>
                                          <span style={{ ...styles.miniScore, color: decided && !t1Won ? "#E8A33D" : "#7A6668" }}>
                                            {m.team2_score != null ? m.team2_score : ""}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                    {champion && (
                      <div style={styles.championBanner}>
                        <Trophy size={15} color="#D9414C" />
                        Победитель: <b style={{ color: "#D9414C" }}>{teamLabel(champion)}</b>
                      </div>
                    )}

                    {tour.status === "registration" && (
                      <div style={styles.regRow}>
                        {!session && <span style={styles.hint}>Войдите в профиль, чтобы зарегистрировать команду.</span>}
                        {session &&
                          (() => {
                            const myRegisteredTeam = teams.find(
                              (t) => t.mode === tour.mode && t.owner_id === session.user.id && registeredIds.includes(t.id)
                            );
                            if (myRegisteredTeam) {
                              return (
                                <>
                                  <span style={styles.hint}>Команда «{myRegisteredTeam.name}» зарегистрирована.</span>
                                  <button
                                    className="nur-btn"
                                    style={{ ...styles.ghostBtnSm, borderColor: "#FF5A5A", color: "#FF5A5A" }}
                                    onClick={() => unregisterTeam(tour.id, myRegisteredTeam.id)}
                                  >
                                    Отменить регистрацию
                                  </button>
                                </>
                              );
                            }
                            return null;
                          })()}
                      {session &&
                        isFull &&
                        !teams.some((t) => t.mode === tour.mode && t.owner_id === session.user.id && registeredIds.includes(t.id)) && (
                          <span style={{ ...styles.hint, color: "#E8A33D" }}>
                            Набран лимит команд ({registeredTeams.length}/{tour.max_teams}) — регистрация закрыта.
                          </span>
                        )}
                      {session &&
                        !isFull &&
                        eligibleTeams.length === 0 &&
                        !teams.some((t) => t.mode === tour.mode && t.owner_id === session.user.id && registeredIds.includes(t.id)) && (
                          <span style={styles.hint}>
                            У вас нет свободной команды режима {MODE_LABEL[tour.mode]}. Создайте её во вкладке «Команды».
                          </span>
                        )}
                      {session && !isFull && eligibleTeams.length > 0 && (
                        <>
                          <select
                            value={regSelections[tour.id] || eligibleTeams[0].id}
                            onChange={(e) => setRegSelections({ ...regSelections, [tour.id]: e.target.value })}
                            style={styles.select}
                          >
                            {eligibleTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="nur-btn"
                            style={styles.accentBtnSm}
                            onClick={() => registerTeam(tour.id, regSelections[tour.id] || eligibleTeams[0].id)}
                          >
                            Зарегистрировать
                          </button>
                        </>
                      )}
                      {(profile?.is_admin || profile?.is_moderator) && (
                        <button
                          className="nur-btn"
                          style={{ ...styles.ghostBtnSm, borderColor: "#E8A33D", color: "#E8A33D" }}
                          disabled={registeredTeams.length < 2}
                          onClick={() => generateBracket(tour.id)}
                        >
                          Сформировать сетку
                        </button>
                      )}
                    </div>
                  )}

                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "0 1 300px", minWidth: 260 }}>

            {ads.slice(0, 2).map((ad) =>
              ad.is_active && ad.image_url && (!ad.expires_at || new Date(ad.expires_at) > new Date()) ? (
                <a key={ad.id} href={ad.link_url || "#"} target="_blank" rel="noopener noreferrer" style={styles.adSlotFilled}>
                  <img src={ad.image_url} alt="Реклама" style={styles.adSlotImg} />
                </a>
              ) : (
                <a key={ad.id} href="https://t.me/tourNUR" target="_blank" rel="noopener noreferrer" style={styles.adSlotEmpty}>
                  <Megaphone size={18} color="#8C7876" />
                  <div style={{ fontSize: 12, color: "#AE9B99", textAlign: "center", marginTop: 8 }}>Тут могла быть ваша реклама</div>
                  <div style={{ fontSize: 11, color: "#E8A33D", textAlign: "center", marginTop: 6 }}>Место продаётся — пишите: @tourNUR</div>
                </a>
              )
            )}
          </div>
          </div>
          </>
        )}

        {activeTab === "matches" && (
          <>
            <div style={styles.secHead}>
              <span style={styles.secNum}>01</span>
              <span style={styles.secTitle}>Матчи</span>
              <span style={styles.secRail} />
            </div>

            <div style={styles.matchFilterRow}>
              {[
                { key: "all", label: "ВСЕ" },
                { key: "live", label: "LIVE" },
                { key: "upcoming", label: "ПРЕДСТОЯТ" },
                { key: "done", label: "ЗАВЕРШЕНЫ" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setMatchFilter(f.key)}
                  style={{ ...styles.pillBtn, ...(matchFilter === f.key ? styles.pillBtnActive : {}) }}
                >
                  <span style={styles.unskew}>{f.label}</span>
                </button>
              ))}
            </div>

            {(() => {
              const liveIds = new Set(
                matchLobbies.filter((l) => l.status === "ready" || l.status === "started").map((l) => `${l.team1_id}|${l.team2_id}`)
              );
              const isLive = (m) => !m.winner_id && (liveIds.has(`${m.team1_id}|${m.team2_id}`) || liveIds.has(`${m.team2_id}|${m.team1_id}`));

              const rows = allBracketMatches
                .filter((m) => m.team1_id && m.team2_id)
                .filter((m) => {
                  if (matchFilter === "live") return isLive(m);
                  if (matchFilter === "upcoming") return !m.winner_id && !isLive(m);
                  if (matchFilter === "done") return !!m.winner_id;
                  return true;
                });

              if (rows.length === 0) {
                return (
                  <div style={styles.emptyStateBox}>
                    <Swords size={26} color="#4A2C2F" />
                    <div style={styles.emptyStateTitle}>Матчей пока нет</div>
                    <div style={styles.emptyStateText}>
                      Матчи появятся здесь, как только в турнире сформируется сетка.
                    </div>
                  </div>
                );
              }

              // Группируем по турниру: у matches нет собственной даты,
              // поэтому турнир — единственная осмысленная единица группировки.
              const byTour = {};
              rows.forEach((m) => {
                if (!byTour[m.tournament_id]) byTour[m.tournament_id] = [];
                byTour[m.tournament_id].push(m);
              });
              const orderedTourIds = Object.keys(byTour).sort(
                (a, b) => (tourOrderIdx[b] ?? 0) - (tourOrderIdx[a] ?? 0)
              );

              return orderedTourIds.map((tid) => {
                const tour = tourById[tid];
                const totalRounds = buildRounds(tid).length;
                const list = byTour[tid].slice().sort((a, b) => b.round - a.round || a.match_index - b.match_index);
                return (
                  <div key={tid} style={{ marginBottom: 26 }}>
                    <div style={styles.matchGroupHead}>
                      <span style={styles.matchGroupName}>{tour ? tour.name : "Турнир"}</span>
                      <span style={styles.matchGroupMeta}>
                        {tour ? MODE_LABEL[tour.mode] : ""} · {list.length}{" "}
                        {list.length === 1 ? "матч" : list.length < 5 ? "матча" : "матчей"}
                      </span>
                    </div>

                    {list.map((m) => {
                      const live = isLive(m);
                      const done = !!m.winner_id;
                      const t1Won = done && m.winner_id === m.team1_id;
                      const t1 = teamMap[m.team1_id];
                      const t2 = teamMap[m.team2_id];
                      return (
                        <div key={m.id} style={styles.matchListRow}>
                          <div style={styles.matchListTop}>
                            <span style={live ? styles.liveTag : done ? styles.doneTag : styles.soonTag}>
                              {live ? "● LIVE" : done ? "ЗАВЕРШЁН" : "ПРЕДСТОИТ"}
                            </span>
                            <span style={styles.matchMap}>{roundLabelShort(m.round, totalRounds)}</span>
                          </div>

                          <div style={styles.matchListBody}>
                            <div style={styles.matchListSide}>
                              <div style={styles.matchListLogo}>
                                {t1?.logo_url ? (
                                  <img src={t1.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 12, color: "#8C7876" }}>
                                    {(t1?.name || "?").slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span style={{ ...styles.matchListName, color: done && !t1Won ? "#7A6668" : "#F3ECEA" }}>
                                {t1 ? teamLabel(t1) : "—"}
                              </span>
                            </div>

                            <div style={styles.matchListScore}>
                              {done && m.team1_score != null && m.team2_score != null ? (
                                <>
                                  <span style={{ color: t1Won ? "#E8A33D" : "#7A6668" }}>{m.team1_score}</span>
                                  <span style={{ color: "#5A4548", margin: "0 4px" }}>:</span>
                                  <span style={{ color: !t1Won ? "#E8A33D" : "#7A6668" }}>{m.team2_score}</span>
                                </>
                              ) : (
                                <span style={{ color: "#5A4548", fontSize: 13 }}>VS</span>
                              )}
                            </div>

                            <div style={{ ...styles.matchListSide, justifyContent: "flex-end" }}>
                              <span
                                style={{
                                  ...styles.matchListName,
                                  textAlign: "right",
                                  color: done && t1Won ? "#7A6668" : "#F3ECEA",
                                }}
                              >
                                {t2 ? teamLabel(t2) : "—"}
                              </span>
                              <div style={styles.matchListLogo}>
                                {t2?.logo_url ? (
                                  <img src={t2.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 12, color: "#8C7876" }}>
                                    {(t2?.name || "?").slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </>
        )}

        {activeTab === "teams" && (
          <div style={styles.stack}>
            <div style={styles.sectionHead}>
              <Users size={16} color="#D9414C" />
              <span style={styles.sectionTitle}>МОИ КОМАНДЫ</span>
            </div>

            {!session && <div style={styles.emptyState}>Войдите в профиль, чтобы создавать команды.</div>}

            {session && (
              <>
                {!showCreateTeam ? (
                  <button className="nur-btn" style={styles.accentBtn} onClick={openCreateTeam}>
                    <Plus size={14} /> Создать команду
                  </button>
                ) : (
                  <div className="nur-mode-card" style={{ ...styles.card, position: "relative", overflow: "hidden" }}>
                    <div style={styles.cardHeadRow}>
                      <div style={styles.cardTitle}>Новая команда</div>
                      <button style={styles.iconBtn} onClick={() => setShowCreateTeam(false)}>
                        <X size={14} />
                      </button>
                    </div>

                    <div style={{ ...styles.hint, marginTop: 12, marginBottom: 6 }}>Режим команды:</div>
                    <ModeToggle value={createTeamMode} onChange={setCreateTeamMode} />

                    {!profile?.is_admin && myTeams(createTeamMode).length >= 1 ? (
                      <div style={{ ...styles.hint, marginTop: 12, color: "#FF5A5A" }}>
                        У вас уже есть команда в режиме {MODE_LABEL[createTeamMode]} — обычным пользователям доступна только одна команда на режим.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <input className="nur-in" placeholder="Название команды" value={teamName} onChange={(e) => setTeamName(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              background: "#1C1315",
                              border: "1px solid #3D2226",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            {newTeamLogoPreview ? (
                              <img src={newTeamLogoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <ShieldPlus size={18} color="#5A4548" />
                            )}
                          </div>
                          <FileChooser
                            label="Логотип команды"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setNewTeamLogoFile(f || null);
                              setNewTeamLogoPreview(f ? URL.createObjectURL(f) : "");
                            }}
                          />
                        </div>
                        <div style={{ marginTop: 10, fontSize: 12, color: "#8C7876" }}>
                          Капитан: {currentUsername}. Остальных игроков можно пригласить после создания команды — приглашённый должен принять запрос.
                        </div>
                        <button className="nur-btn" style={{ ...styles.accentBtn, marginTop: 14 }} onClick={createTeam} disabled={!teamName.trim()}>
                          Создать команду
                        </button>
                      </>
                    )}
                  </div>
                )}

                {teams.filter((t) => t.owner_id === session.user.id).length === 0 && (
                  <div style={styles.emptyState}>Команд пока нет.</div>
                )}
                {teams
                  .filter((t) => t.owner_id === session.user.id)
                  .map((t) => (
                  <div key={t.id} style={styles.card}>
                    <div style={styles.cardHeadRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <IconFileChooser
                          title="Изменить логотип команды"
                          onChange={(e) => uploadTeamLogo(t.id, e.target.files?.[0])}
                          icon={
                            t.logo_url ? (
                              <img src={t.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                            ) : (
                              <Camera size={13} color="#5A4548" />
                            )
                          }
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: "1px solid #3D2226",
                            background: "#1C1315",
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        />
                        <div style={styles.cardTitle}>
                          {t.tag && <span style={{ color: "#D9414C" }}>[{t.tag}] </span>}
                          {t.name} <span style={{ color: "#E8A33D", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>· {MODE_LABEL[t.mode]}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={styles.badge}>
                          {(t.team_members || []).length}/{t.max_size}
                        </span>
                        <button style={styles.iconBtn} onClick={() => setConfirmDeleteTeamId(t.id === confirmDeleteTeamId ? null : t.id)}>
                          <Trash2 size={14} color="#FF5A5A" />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {(t.team_members || []).map((m, i) => (
                        <span key={i} style={styles.memberChip}>
                          {m.member_name}
                        </span>
                      ))}
                    </div>
                    {(t.team_members || []).length < t.max_size && (
                      <div style={{ position: "relative", marginTop: 10 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="nur-in"
                            placeholder="Никнейм тиммейта, чтобы пригласить"
                            value={addMemberQuery[t.id] || ""}
                            onChange={(e) => {
                              setAddMemberQuery((prev) => ({ ...prev, [t.id]: e.target.value }));
                              searchTeammate(t.id, e.target.value);
                            }}
                            style={{ ...styles.input, flex: 1 }}
                          />
                        </div>
                        {(addMemberResults[t.id] || []).length > 0 && (
                          <div style={styles.suggestBox}>
                            {addMemberResults[t.id].map((p) => (
                              <div key={p.id} style={{ ...styles.suggestItem, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>{p.username}</span>
                                <button className="nur-btn" style={styles.accentBtnSm} onClick={() => inviteToTeam(t, p)}>
                                  <Plus size={12} /> Пригласить
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {confirmDeleteTeamId === t.id && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button style={{ ...styles.ghostBtnSm, borderColor: "#FF5A5A", color: "#FF5A5A" }} onClick={() => deleteTeam(t.id)}>
                          Подтвердить удаление
                        </button>
                        <button style={styles.ghostBtnSm} onClick={() => setConfirmDeleteTeamId(null)}>
                          Отмена
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === "lfg" && (
          <div style={styles.stack}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 22, letterSpacing: 0.5, color: "#F3ECEA" }}>Поиск тиммейтов</div>
                <div style={{ fontSize: 12.5, color: "#8C7876", marginTop: 4 }}>
                  Ищешь игрока в команду или команду для себя — оставь объявление
                </div>
              </div>
              {session && (
                <button className="nur-btn" style={styles.accentBtn} onClick={() => setShowCreateLfg((v) => !v)}>
                  {showCreateLfg ? "Отмена" : "+ Создать объявление"}
                </button>
              )}
            </div>

            {showCreateLfg && session && (
              <div style={styles.card}>
                <div style={{ ...styles.hint, marginBottom: 8 }}>Тип объявления:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { id: "need_player", label: "Ищу игрока в команду" },
                    { id: "need_team", label: "Ищу команду для себя" },
                  ].map((k) => (
                    <button
                      key={k.id}
                      className="nur-btn"
                      style={{
                        ...styles.ghostBtnSm,
                        background: newLfgKind === k.id ? "#2A1416" : "transparent",
                        borderColor: newLfgKind === k.id ? "#D9414C" : "#3D2226",
                        color: newLfgKind === k.id ? "#F3ECEA" : "#AE9B99",
                      }}
                      onClick={() => setNewLfgKind(k.id)}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <div style={{ ...styles.hint, marginTop: 14, marginBottom: 6 }}>Режим:</div>
                <ModeToggle value={newLfgMode} onChange={setNewLfgMode} />

                {newLfgKind === "need_player" && (
                  <>
                    <div style={{ ...styles.hint, marginTop: 14, marginBottom: 6 }}>Команда:</div>
                    <select value={newLfgTeamId} onChange={(e) => setNewLfgTeamId(e.target.value)} style={styles.select}>
                      <option value="">— выберите команду —</option>
                      {teams
                        .filter((t) => t.owner_id === session.user.id && t.mode === newLfgMode)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {teamLabel(t)} ({(t.team_members || []).length}/{t.max_size})
                          </option>
                        ))}
                    </select>
                  </>
                )}

                <div style={{ ...styles.hint, marginTop: 14, marginBottom: 6 }}>Описание (до 300 символов):</div>
                <textarea
                  className="nur-in"
                  value={newLfgDesc}
                  onChange={(e) => setNewLfgDesc(e.target.value.slice(0, 300))}
                  onKeyDown={playTypeSound}
                  placeholder="Например: нужен второй в состав на постоянку, играем по вечерам…"
                  rows={3}
                  style={{ ...styles.input, width: "100%", resize: "vertical", fontFamily: "'Inter', sans-serif" }}
                />
                <button className="nur-btn" style={{ ...styles.accentBtn, marginTop: 12 }} onClick={createLfgPost}>
                  Опубликовать
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { id: "all", label: "Все" },
                { id: "need_player", label: "Ищут игрока" },
                { id: "need_team", label: "Ищут команду" },
                { id: "5x5", label: "5 на 5" },
                { id: "2x2", label: "2 на 2" },
                { id: "online", label: "Сейчас на сайте" },
              ].map((f) => (
                <button
                  key={f.id}
                  className="nur-btn"
                  style={{
                    ...styles.ghostBtnSm,
                    borderRadius: 999,
                    background: lfgFilter === f.id ? "#D9414C" : "transparent",
                    borderColor: lfgFilter === f.id ? "#D9414C" : "#3D2226",
                    color: lfgFilter === f.id ? "#fff" : "#AE9B99",
                    fontWeight: lfgFilter === f.id ? 600 : 400,
                  }}
                  onClick={() => setLfgFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {(() => {
              const filtered = lfgPosts.filter((p) => {
                if (lfgFilter === "all") return true;
                if (lfgFilter === "need_player" || lfgFilter === "need_team") return p.kind === lfgFilter;
                if (lfgFilter === "5x5" || lfgFilter === "2x2") return p.mode === lfgFilter;
                if (lfgFilter === "online") return onlineUserIds.has(p.author_id);
                return true;
              });
              if (filtered.length === 0) {
                return <div style={styles.emptyState}>Пока нет объявлений по этому фильтру.</div>;
              }
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                  {filtered.map((p) => {
                    const team = p.team_id ? teamMap[p.team_id] : null;
                    const needPlayer = p.kind === "need_player";
                    const freeSlots = team ? team.max_size - (team.team_members || []).length : null;
                    const isMine = session && p.author_id === session.user.id;
                    return (
                      <div key={p.id} style={{ ...styles.card, position: "relative", overflow: "hidden", paddingTop: 26 }}>
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            fontSize: 9.5,
                            letterSpacing: 1,
                            fontWeight: 700,
                            padding: "4px 12px 4px 10px",
                            borderBottomRightRadius: 10,
                            textTransform: "uppercase",
                            background: needPlayer ? "#3A2116" : "#2A1F3A",
                            color: needPlayer ? "#E8A33D" : "#A78BE8",
                          }}
                        >
                          {needPlayer ? "Ищут игрока" : "Ищет команду"}
                        </div>

                        <div style={{ display: "flex", gap: 12 }}>
                          <div
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 10,
                              flexShrink: 0,
                              background: "linear-gradient(140deg, #2E1B1E, #1C1315)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "'Anton', sans-serif",
                              color: "#D9414C",
                              fontSize: 18,
                              overflow: "hidden",
                            }}
                          >
                            {team?.logo_url ? (
                              <img src={team.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              ((needPlayer ? team?.name : p.author?.username) || "?")[0].toUpperCase()
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#F3ECEA" }}>
                                {needPlayer ? (team ? teamLabel(team) : "Команда удалена") : p.author?.username}
                              </span>
                              <span style={{ fontSize: 10.5, color: "#7A6668", background: "#1C1315", border: "1px solid #2A1B1D", padding: "2px 8px", borderRadius: 6 }}>
                                {MODE_LABEL[p.mode]}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: needPlayer && team && freeSlots <= 0 ? "#8C7876" : "#6FBF73", marginTop: 4 }}>
                              {needPlayer
                                ? team
                                  ? `В составе: ${(team.team_members || []).length} / ${team.max_size}`
                                  : "—"
                                : "Соло-игрок ищет состав"}
                            </div>
                            {p.description && (
                              <div style={{ fontSize: 12.5, color: "#C4B4B2", marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{p.description}</div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid #241618" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => openUserProfile(p.author)}>
                            <div style={{ ...styles.avatarWrapSm, position: "relative" }}>
                              {p.author?.avatar_url ? (
                                <img src={p.author.avatar_url} alt="" style={styles.avatarImgSm} />
                              ) : (
                                <div style={styles.avatarFallbackSm}>{(p.author?.username || "?")[0].toUpperCase()}</div>
                              )}
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: -1,
                                  right: -1,
                                  width: 7,
                                  height: 7,
                                  borderRadius: "50%",
                                  border: "2px solid #150F10",
                                  background: onlineUserIds.has(p.author_id) ? "#6FBF73" : "#5A2E33",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 12, color: "#AE9B99" }}>{p.author?.username}</span>
                            <span style={{ fontSize: 10.5, color: "#5A4548" }}>{formatDateTime(p.created_at)}</span>
                          </div>
                          {isMine ? (
                            <button className="nur-btn" style={{ ...styles.ghostBtnSm, borderColor: "#5A2E33", color: "#FF8A8A" }} onClick={() => deleteLfgPost(p.id)}>
                              <Trash2 size={12} /> Удалить
                            </button>
                          ) : session ? (
                            friends.some((f) => f.id === p.author_id) ? (
                              <button
                                className="nur-btn"
                                style={{ ...styles.ghostBtnSm, borderColor: "#D9414C", color: "#D9414C" }}
                                onClick={() => openChat(p.author)}
                              >
                                Написать
                              </button>
                            ) : sentPendingRequests.some((r) => r.id === p.author_id) ? (
                              <span style={{ ...styles.ghostBtnSm, color: "#7A6668", cursor: "default" }}>Заявка отправлена</span>
                            ) : (
                              <button
                                className="nur-btn"
                                style={{ ...styles.ghostBtnSm, borderColor: "#D9414C", color: "#D9414C" }}
                                title="Отправит заявку в друзья — после принятия сможете переписываться"
                                onClick={() => sendFriendRequest(p.author_id)}
                              >
                                Откликнуться
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "dialogs" && session && (
          <div style={{ ...styles.card, padding: 0, overflow: "hidden", display: "flex", height: "calc(100vh - 160px)", minHeight: 420 }}>
            <div style={{ width: 260, borderRight: "1px solid #2A1B1D", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #2A1B1D", fontSize: 13, fontWeight: 700, color: "#F3ECEA" }}>
                Все диалоги
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {friends.length === 0 && <div style={{ ...styles.hint, padding: 16 }}>Добавьте друзей, чтобы начать переписку.</div>}
                {[...friends]
                  .sort((a, b) => (unreadCounts[b.id] || 0) - (unreadCounts[a.id] || 0) || (onlineUserIds.has(b.id) ? 1 : 0) - (onlineUserIds.has(a.id) ? 1 : 0))
                  .map((f) => (
                    <div
                      key={f.requestId}
                      onClick={() => openChat(f)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 16px",
                        cursor: "pointer",
                        background: activeChatFriend?.id === f.id ? "#1C1315" : "transparent",
                        borderLeft: activeChatFriend?.id === f.id ? "2px solid #D9414C" : "2px solid transparent",
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <div style={styles.avatarWrapSm}>
                          {f.avatar_url ? (
                            <img src={f.avatar_url} alt="" style={styles.avatarImgSm} />
                          ) : (
                            <div style={styles.avatarFallbackSm}>{(f.username || "?")[0].toUpperCase()}</div>
                          )}
                        </div>
                        <span
                          style={{
                            position: "absolute",
                            bottom: -1,
                            right: -1,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            border: "2px solid #150F10",
                            background: onlineUserIds.has(f.id) ? "#6FBF73" : "#5A2E33",
                          }}
                        />
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: mutedUserIds.has(f.id) ? "#7A6668" : "#F3ECEA" }}>{f.username}</span>
                      {mutedUserIds.has(f.id) && <BellOff size={13} color="#7A6668" />}
                      {unreadCounts[f.id] > 0 && !mutedUserIds.has(f.id) && <span style={styles.notifyDot} />}
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {!activeChatFriend ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <MessageCircle size={34} color="#3D2226" />
                  <div style={{ ...styles.hint, textAlign: "center" }}>
                    Выберите диалог из списка слева,
                    <br />
                    чтобы начать общение
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #2A1B1D" }}>
                    <div style={styles.avatarWrapSm}>
                      {activeChatFriend.avatar_url ? (
                        <img src={activeChatFriend.avatar_url} alt="" style={styles.avatarImgSm} />
                      ) : (
                        <div style={styles.avatarFallbackSm}>{(activeChatFriend.username || "?")[0].toUpperCase()}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#F3ECEA", flex: 1 }}>{activeChatFriend.username}</span>
                    <button
                      className="nur-btn"
                      style={styles.ghostBtnSm}
                      title={mutedUserIds.has(activeChatFriend.id) ? "Убрать из мута" : "Замьютить — сообщения перестанут уведомлять"}
                      onClick={() => (mutedUserIds.has(activeChatFriend.id) ? unmuteUser(activeChatFriend.id) : muteUser(activeChatFriend.id))}
                    >
                      {mutedUserIds.has(activeChatFriend.id) ? (
                        <>
                          <Bell size={13} /> Размьютить
                        </>
                      ) : (
                        <>
                          <BellOff size={13} /> Мьют
                        </>
                      )}
                    </button>
                  </div>
                  <div ref={chatMessagesRef} className="nur-chat-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {chatMessages.length === 0 && <div style={{ ...styles.hint, textAlign: "center", marginTop: 20 }}>Начните переписку</div>}
                    {chatMessages.map((m) => {
                      const mine = m.sender_id === session?.user.id;
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                          <div style={{ ...styles.chatBubble, ...(mine ? styles.chatBubbleMine : styles.chatBubbleTheirs) }}>{m.content}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #2A1B1D" }}>
                    <input
                      className="nur-in"
                      placeholder="Введите ваше сообщение…"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        playTypeSound(e);
                        if (e.key === "Enter") sendChatMessage();
                      }}
                      style={{ ...styles.input, flex: 1 }}
                    />
                    <button className="nur-btn" style={styles.accentBtnSm} onClick={sendChatMessage}>
                      Отпр.
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div style={{ ...styles.stack, maxWidth: 380 }}>
            <div style={styles.sectionHead}>
              <ShieldCheck size={16} color="#D9414C" />
              <span style={styles.sectionTitle}>ПРОФИЛЬ</span>
            </div>

            {session ? (
              <>
                <div style={{ ...styles.card, padding: 0, overflow: "hidden", borderRadius: 0 }}>
                  <div
                    style={{
                      position: "relative",
                      height: 108,
                      background: "linear-gradient(120deg, #2A1416 0%, #1A0D0E 55%, #150F10 100%)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "repeating-linear-gradient(115deg, transparent 0px, transparent 16px, rgba(217,65,76,0.08) 16px, rgba(217,65,76,0.08) 17px)",
                        pointerEvents: "none",
                      }}
                    />
                    {profile?.banner_url && (
                      <img src={profile.banner_url} alt="" style={{ ...styles.profileBannerImg, position: "absolute", inset: 0 }} />
                    )}
                    <div style={{ position: "absolute", top: 14, left: 18, fontSize: 10, letterSpacing: 2, color: "#E8A33D", fontWeight: 600 }}>NUR · ID</div>
                    <IconFileChooser
                      title="Изменить баннер"
                      disabled={bannerUploading}
                      onChange={(e) => uploadBanner(e.target.files?.[0])}
                      icon={bannerUploading ? <Loader2 size={12} color="#F3ECEA" style={{ animation: "spin 0.8s linear infinite" }} /> : <Camera size={12} color="#F3ECEA" />}
                      style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 0, border: "1px solid rgba(243,236,234,0.3)", background: "rgba(21,15,16,0.6)", zIndex: 2 }}
                    />
                  </div>
                  <div style={{ padding: "0 20px 18px", position: "relative" }}>
                    <div style={{ position: "relative", width: 76, height: 76, marginTop: -38, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
                          background: "#150F10",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "88%",
                            height: "88%",
                            clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
                            background: "linear-gradient(135deg, #2E1B1E, #1C1315)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 26, color: "#D9414C" }}>{(currentUsername || "?")[0].toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                      <IconFileChooser
                        title="Изменить аватар"
                        disabled={avatarUploading}
                        onChange={(e) => uploadAvatar(e.target.files?.[0])}
                        icon={avatarUploading ? <Loader2 size={9} color="#150F10" style={{ animation: "spin 0.8s linear infinite" }} /> : <Camera size={9} color="#150F10" />}
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 22,
                          height: 22,
                          borderRadius: 0,
                          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                          background: "#E8A33D",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 22, letterSpacing: 0.5, color: "#F3ECEA" }}>
                        {currentUsername || session.user.email}
                      </span>
                      {profile?.is_admin && (
                        <span style={{ fontSize: 10, padding: "3px 9px", background: "#3A2116", color: "#E8A33D", borderLeft: "2px solid #E8A33D", letterSpacing: 1, fontWeight: 600 }}>
                          АДМИНИСТРАТОР
                        </span>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 16, borderTop: "1px solid #2A1B1D", borderBottom: "1px solid #2A1B1D" }}>
                      <div style={{ textAlign: "center", padding: "10px 4px", borderRight: "1px solid #2A1B1D" }}>
                        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: "#F3ECEA" }}>
                          {teams.filter((t) => t.owner_id === session.user.id).length}
                        </div>
                        <div style={{ fontSize: 9.5, color: "#8C7876", letterSpacing: 0.5, marginTop: 2, textTransform: "uppercase" }}>Команд</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "10px 4px", borderRight: "1px solid #2A1B1D" }}>
                        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: "#F3ECEA" }}>{friends.length}</div>
                        <div style={{ fontSize: 9.5, color: "#8C7876", letterSpacing: 0.5, marginTop: 2, textTransform: "uppercase" }}>Друзей</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "10px 4px" }}>
                        <div
                          style={{
                            fontFamily: "'Anton', sans-serif",
                            fontSize: 13,
                            color: onlineUserIds.has(session.user.id) ? "#6FBF73" : "#8C7876",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: onlineUserIds.has(session.user.id) ? "#6FBF73" : "#5A2E33" }} />
                          {onlineUserIds.has(session.user.id) ? "В сети" : "Не в сети"}
                        </div>
                        <div style={{ fontSize: 9.5, color: "#8C7876", letterSpacing: 0.5, marginTop: 2, textTransform: "uppercase" }}>Статус</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ ...styles.hint, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 11.5 }}>О себе</span>
                        <span style={{ ...styles.hint, fontSize: 10.5 }}>{bioDraft.length} / 300</span>
                      </div>
                      <textarea
                        className="nur-in"
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value.slice(0, 300))}
                        onKeyDown={playTypeSound}
                        placeholder="Расскажите немного о себе…"
                        rows={3}
                        style={{ ...styles.input, width: "100%", resize: "vertical", fontFamily: "'Inter', sans-serif", borderRadius: 0, borderLeft: "2px solid #D9414C" }}
                      />
                      <button
                        className="nur-btn"
                        style={{ ...styles.ghostBtnSm, marginTop: 8, borderRadius: 0, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 11.5 }}
                        disabled={bioSaving || bioDraft === (profile?.bio || "")}
                        onClick={saveBio}
                      >
                        {bioSaving ? "Сохраняем…" : "Сохранить"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 1, marginTop: 16, background: "#2A1B1D" }}>
                      <button
                        className="nur-btn"
                        style={{
                          ...styles.ghostBtnSm,
                          flex: 1,
                          justifyContent: "center",
                          border: "none",
                          borderRadius: 0,
                          background: "#150F10",
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                          fontSize: 11.5,
                          color: profile?.is_closed ? "#FF5A5A" : "#AE9B99",
                        }}
                        onClick={() => toggleClosedProfile({ id: session.user.id, is_closed: profile?.is_closed })}
                      >
                        <ShieldAlert size={13} /> {profile?.is_closed ? "Открыть анкету" : "Закрыть анкету"}
                      </button>
                      <button
                        className="nur-btn"
                        style={{ ...styles.ghostBtnSm, flex: 1, justifyContent: "center", border: "none", borderRadius: 0, background: "#150F10", letterSpacing: 0.5, textTransform: "uppercase", fontSize: 11.5, color: "#FF8A8A" }}
                        onClick={doLogout}
                      >
                        <LogOut size={13} /> Выйти
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ ...styles.card, borderRadius: 0, userSelect: "none" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => setSoundsCardOpen((v) => !v)}
                  >
                    <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 13, letterSpacing: 1, color: "#F3ECEA", textTransform: "uppercase", borderLeft: "2px solid #D9414C", paddingLeft: 8 }}>
                      Звуки
                    </div>
                    <ChevronDown
                      size={16}
                      color="#AE9B99"
                      style={{ transform: soundsCardOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
                    />
                  </div>

                  {soundsCardOpen && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                        <span style={{ fontSize: 12.5, color: "#AE9B99" }}>Звук при печати текста</span>
                        <div
                          onClick={toggleTypeSound}
                          style={{
                            width: 46,
                            height: 26,
                            borderRadius: 13,
                            background: typeSoundOn ? "#D9414C" : "#2E1B1E",
                            border: "1px solid #3D2226",
                            cursor: "pointer",
                            position: "relative",
                            transition: "background 0.2s ease",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 2,
                              left: typeSoundOn ? 22 : 2,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "#F3ECEA",
                              transition: "left 0.2s ease",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, color: "#AE9B99" }}>Громкость</span>
                          <span style={{ fontSize: 11.5, color: "#7A6668" }}>{Math.round(soundVolume * 100)}%</span>
                        </div>
                        <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center", overflow: "hidden", borderRadius: 6 }}>
                          <div className="nur-menu-smoke" style={{ opacity: 0.6 }} />
                          <input
                            className="nur-volume-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={soundVolume}
                            onChange={(e) => changeSoundVolume(parseFloat(e.target.value))}
                            style={{ position: "relative", zIndex: 1 }}
                          />
                        </div>
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#AE9B99", cursor: "pointer", marginTop: 14 }}>
                        <input type="checkbox" checked={skipBackspaceSound} onChange={toggleSkipBackspaceSound} />
                        Без звука на стирание
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#AE9B99", cursor: "pointer", marginTop: 8 }}>
                        <input type="checkbox" checked={skipSpaceSound} onChange={toggleSkipSpaceSound} />
                        Без звука на пробел
                      </label>

                      <div style={{ ...styles.hint, marginTop: 14, marginBottom: 8 }}>Выберите звук (клик проигрывает пример):</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {SOUND_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            className="nur-btn"
                            style={
                              soundPresetId === p.id
                                ? { ...styles.accentBtnSm, fontSize: 12 }
                                : { ...styles.ghostBtnSm, fontSize: 12 }
                            }
                            onClick={() => selectSoundPreset(p.id)}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>

                      <div style={{ ...styles.hint, marginTop: 14, marginBottom: 6 }}>Проверить, как звучит при печати:</div>
                      <input
                        className="nur-in"
                        placeholder="Печатайте здесь для проверки…"
                        onKeyDown={playTypeSound}
                        style={{ ...styles.input, width: "100%" }}
                      />
                      <div style={{ fontSize: 11, color: "#5A4548", marginTop: 16, textAlign: "center" }}>
                        Есть идеи, какой звук добавить? Пишите: @quqububu
                      </div>
                    </>
                  )}
                </div>

                <div style={{ ...styles.card, borderRadius: 0 }}>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 13, letterSpacing: 1, color: "#F3ECEA", textTransform: "uppercase", borderLeft: "2px solid #D9414C", paddingLeft: 8 }}>
                    Друзья · {friends.length}
                  </div>

                  {incomingRequests.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ ...styles.hint, marginBottom: 6 }}>Заявки в друзья:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {incomingRequests.map((r) => (
                          <div key={r.requestId} style={styles.friendRow}>
                            <div style={{ ...styles.avatarWrapSm, cursor: "pointer" }} onClick={() => openUserProfile(r)}>
                              {r.avatar_url ? (
                                <img src={r.avatar_url} alt="" style={styles.avatarImgSm} />
                              ) : (
                                <div style={styles.avatarFallbackSm}>{(r.username || "?")[0].toUpperCase()}</div>
                              )}
                            </div>
                            <span style={{ flex: 1, fontSize: 13.5, cursor: "pointer", userSelect: "none" }} onClick={() => openUserProfile(r)}>
                              {r.username}
                            </span>
                            <button style={styles.iconBtn} onClick={() => acceptFriendRequest(r.requestId)}>
                              <Check size={13} color="#6FBF73" />
                            </button>
                            <button style={styles.iconBtn} onClick={() => removeFriend(r.requestId)}>
                              <X size={13} color="#FF5A5A" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sentPendingRequests.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ ...styles.hint, marginBottom: 6 }}>Отправленные заявки (ожидают ответа):</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {sentPendingRequests.map((r) => (
                          <div key={r.requestId} style={styles.friendRow}>
                            <div style={{ ...styles.avatarWrapSm, cursor: "pointer" }} onClick={() => openUserProfile(r)}>
                              {r.avatar_url ? (
                                <img src={r.avatar_url} alt="" style={styles.avatarImgSm} />
                              ) : (
                                <div style={styles.avatarFallbackSm}>{(r.username || "?")[0].toUpperCase()}</div>
                              )}
                            </div>
                            <span style={{ flex: 1, fontSize: 13.5, cursor: "pointer", userSelect: "none" }} onClick={() => openUserProfile(r)}>
                              {r.username}
                            </span>
                            <button style={styles.iconBtn} onClick={() => removeFriend(r.requestId)}>
                              <X size={13} color="#FF5A5A" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {friends.length === 0 && <span style={styles.hint}>Пока никого не добавили.</span>}
                    {friends.map((f) => (
                      <div key={f.requestId} style={styles.friendRow}>
                        <div style={{ ...styles.avatarWrapSm, cursor: "pointer", position: "relative" }} onClick={() => openUserProfile(f)}>
                          {f.avatar_url ? (
                            <img src={f.avatar_url} alt="" style={styles.avatarImgSm} />
                          ) : (
                            <div style={styles.avatarFallbackSm}>{(f.username || "?")[0].toUpperCase()}</div>
                          )}
                          <span
                            style={{
                              position: "absolute",
                              bottom: -1,
                              right: -1,
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              border: "2px solid #150F10",
                              background: onlineUserIds.has(f.id) ? "#6FBF73" : "#5A2E33",
                            }}
                          />
                        </div>
                        <span style={{ flex: 1, fontSize: 13.5, cursor: "pointer", userSelect: "none" }} onClick={() => openUserProfile(f)}>
                          {f.username}
                        </span>
                        <button
                          style={{ ...styles.iconBtn, position: "relative" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openChat(f);
                          }}
                        >
                          <MessageCircle size={14} color="#E8A33D" />
                          {unreadCounts[f.id] > 0 && <span style={styles.notifyDot} />}
                        </button>
                        <button
                          style={styles.iconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFriend(f.requestId);
                          }}
                        >
                          <X size={13} color="#FF5A5A" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: "relative", marginTop: 12 }}>
                    <input
                      className="nur-in"
                      placeholder="Никнейм, чтобы отправить заявку в друзья"
                      value={friendQuery}
                      onChange={(e) => {
                        setFriendQuery(e.target.value);
                        searchFriendCandidates(e.target.value);
                      }}
                      style={styles.input}
                    />
                    {friendResults.length > 0 && (
                      <div style={styles.suggestBox}>
                        {friendResults.map((p) => (
                          <div key={p.id} style={{ ...styles.suggestItem, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{p.username}</span>
                            {sentPendingIds.includes(p.id) ? (
                              <span style={{ ...styles.hint, fontSize: 11 }}>Заявка отправлена</span>
                            ) : (
                              <button className="nur-btn" style={styles.accentBtnSm} onClick={() => sendFriendRequest(p.id)}>
                                <UserPlus size={12} /> Добавить
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.card}>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  <button
                    style={{ ...styles.segBtn, ...(authScreen === "login" ? styles.segBtnActive : {}) }}
                    onClick={() => { setAuthScreen("login"); setErrorMsg(""); }}
                  >
                    Вход
                  </button>
                  <button
                    style={{ ...styles.segBtn, ...(authScreen === "register" ? styles.segBtnActive : {}) }}
                    onClick={() => { setAuthScreen("register"); setErrorMsg(""); }}
                  >
                    Регистрация
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {authScreen === "register" && (
                    <input className="nur-in" placeholder="Никнейм" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} />
                  )}
                  <input className="nur-in" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
                  <input
                    className="nur-in"
                    placeholder="Пароль"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (authScreen === "login" ? doLogin() : doRegister())}
                    style={styles.input}
                  />
                  <button className="nur-btn" style={styles.accentBtn} onClick={authScreen === "login" ? doLogin : doRegister}>
                    {authScreen === "login" ? "Войти" : "Зарегистрироваться"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "admin" && (
          <div style={styles.stack}>
            <div style={styles.sectionHead}>
              <Settings size={16} color="#D9414C" />
              <span style={styles.sectionTitle}>АДМИН-ПАНЕЛЬ</span>
            </div>

            {!session && <div style={styles.emptyState}>Войдите в профиль, чтобы получить доступ.</div>}
            {session && !profile?.is_admin && !profile?.is_moderator && (
              <div style={styles.emptyState}>
                У вашего аккаунта нет прав администратора или модератора. Их выдаёт владелец сайта (администратор может выдать статус модератора прямо со страницы профиля игрока).
              </div>
            )}

            {session && (profile?.is_admin || profile?.is_moderator) && (
              <>
                {profile?.is_admin && (
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Реклама (боковые слоты на «Турниры»)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                    {ads.map((ad) => (
                      <div key={ad.id} style={{ border: "1px solid #3D2226", borderRadius: 8, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ color: "#F3ECEA", fontSize: 13, fontWeight: 600 }}>Слот {ad.slot}</span>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#AE9B99", cursor: "pointer" }}>
                            <input type="checkbox" checked={ad.is_active} onChange={() => toggleAdActive(ad)} />
                            Показывать
                          </label>
                        </div>
                        {ad.image_url && <img src={ad.image_url} alt="" style={{ width: "100%", maxWidth: 200, marginTop: 8, borderRadius: 6 }} />}
                        {ad.expires_at && (
                          <div style={{ ...styles.hint, marginTop: 6 }}>
                            Истекает: {formatDateTime(ad.expires_at)}
                            {new Date(ad.expires_at) < new Date() && <span style={{ color: "#FF5A5A" }}> — уже истекло</span>}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 160px" }}>
                            <FileChooser id={`ad-file-${ad.slot}`} />
                          </div>
                          <input
                            className="nur-in"
                            placeholder="Ссылка (https://...)"
                            value={adLinkDrafts[ad.slot] !== undefined ? adLinkDrafts[ad.slot] : ad.link_url || ""}
                            onChange={(e) => setAdLinkDrafts((prev) => ({ ...prev, [ad.slot]: e.target.value }))}
                            style={{ ...styles.input, flex: "1 1 200px" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ ...styles.hint, marginBottom: 4 }}>Удалить рекламу автоматически (необязательно):</div>
                            <input
                              type="datetime-local"
                              value={
                                adExpiryDrafts[ad.slot] !== undefined
                                  ? adExpiryDrafts[ad.slot]
                                  : ad.expires_at
                                  ? (() => {
                                      const d = new Date(ad.expires_at);
                                      const tzOff = d.getTimezoneOffset() * 60000;
                                      return new Date(d.getTime() - tzOff).toISOString().slice(0, 16);
                                    })()
                                  : ""
                              }
                              onChange={(e) => setAdExpiryDrafts((prev) => ({ ...prev, [ad.slot]: e.target.value }))}
                              style={styles.input}
                            />
                          </div>
                          <button
                            className="nur-btn"
                            style={{ ...styles.accentBtnSm, marginTop: 16 }}
                            disabled={adUploading[ad.slot]}
                            onClick={() => {
                              const fileInput = document.getElementById(`ad-file-${ad.slot}`);
                              saveAdSlot(ad, fileInput?.files?.[0] || null);
                            }}
                          >
                            {adUploading[ad.slot] ? "Сохраняем…" : "Сохранить"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {profile?.is_admin && (
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Карты (фон на экране бана карт)</div>
                  <div style={{ ...styles.hint, marginTop: 6, marginBottom: 12 }}>
                    Необязательно — если фото не загружено, используется красивая заливка по умолчанию. Можно продать это место как рекламу (постер вместо фона карты).
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "flex-end", flexWrap: "wrap" }}>
                    {MAP_POOL.map((mapKey) => (
                      <div key={mapKey} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            position: "relative",
                            width: 118,
                            height: 300,
                            overflow: "hidden",
                            border: "1px solid #3D2226",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            transform: "skewX(-7deg)",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: "-6% -14%",
                              background: mapImages[mapKey] ? `url(${mapImages[mapKey]}) center/cover` : MAP_GRADIENT[mapKey],
                            }}
                          />
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.93) 100%)" }} />
                          <div style={{ position: "relative", padding: "10px 8px 14px", textAlign: "center", transform: "skewX(7deg)" }}>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#E8A33D" }}>
                              Забанить
                            </div>
                            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 19, letterSpacing: 1, textTransform: "uppercase", marginTop: 3, color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}>
                              {MAP_LABEL[mapKey]}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", width: 130 }}>
                          <FileChooser id={`map-file-${mapKey}`} label="Фото" />
                          <button
                            className="nur-btn"
                            style={{ ...styles.accentBtnSm, width: "100%", justifyContent: "center" }}
                            disabled={mapImageUploading[mapKey]}
                            onClick={() => {
                              const fileInput = document.getElementById(`map-file-${mapKey}`);
                              if (fileInput?.files?.[0]) saveMapImage(mapKey, fileInput.files[0]);
                            }}
                          >
                            {mapImageUploading[mapKey] ? "…" : "Сохранить"}
                          </button>
                          {mapImages[mapKey] && (
                            <button
                              style={{ ...styles.ghostBtnSm, borderColor: "#FF5A5A", color: "#FF5A5A", width: "100%", justifyContent: "center", fontSize: 11 }}
                              onClick={() => removeMapImage(mapKey)}
                            >
                              Сбросить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                <div className="nur-mode-card" style={{ ...styles.card, position: "relative", overflow: "hidden" }}>
                  <div style={styles.cardTitle}>Создать турнир</div>
                  <div style={{ marginTop: 12 }}>
                    <ModeToggle value={newTourMode} onChange={setNewTourMode} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <input className="nur-in" placeholder="Название турнира" value={newTourName} onChange={(e) => setNewTourName(e.target.value)} style={{ ...styles.input, flex: 1, minWidth: 180 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <input
                      className="nur-in"
                      placeholder="Призовой фонд (например: 1 место — 450₽, 2 место — 100₽)"
                      value={newTourPrize}
                      onChange={(e) => setNewTourPrize(e.target.value)}
                      style={{ ...styles.input, flex: 1, minWidth: 220 }}
                    />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...styles.hint, marginBottom: 6 }}>Формат (число команд):</div>
                    <ModeToggle value={newTourMaxTeams} onChange={setNewTourMaxTeams} options={TOURNAMENT_FORMATS} />
                    <div style={{ ...styles.hint, marginTop: 6 }}>{TOURNAMENT_FORMAT_DESC[newTourMaxTeams]}</div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...styles.hint, marginBottom: 6 }}>Баннер турнира (необязательно, картинка):</div>
                    <FileChooser onChange={(e) => setNewTourBannerFile(e.target.files?.[0] || null)} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ ...styles.hint, marginBottom: 4 }}>Анонс</div>
                      <input type="datetime-local" value={newTourAnnounceAt} onChange={(e) => setNewTourAnnounceAt(e.target.value)} style={styles.input} />
                    </div>
                    <div>
                      <div style={{ ...styles.hint, marginBottom: 4 }}>Открытие регистрации</div>
                      <input type="datetime-local" value={newTourRegOpenAt} onChange={(e) => setNewTourRegOpenAt(e.target.value)} style={styles.input} />
                    </div>
                    <div>
                      <div style={{ ...styles.hint, marginBottom: 4 }}>Старт игры</div>
                      <input type="datetime-local" value={newTourStartAt} onChange={(e) => setNewTourStartAt(e.target.value)} style={styles.input} />
                    </div>
                  </div>
                  <button className="nur-btn" style={{ ...styles.accentBtnSm, marginTop: 12 }} onClick={createTournament} disabled={tourCreating || !newTourName.trim()}>
                    <Plus size={13} /> {tourCreating ? "Создаём…" : "Создать"}
                  </button>
                </div>

                {profile?.is_admin && (
                <>
                {tournaments.length === 0 && <div style={styles.emptyState}>Турниров ещё не создано.</div>}

                {tournaments.map((tour) => {
                  const registeredIds = (tour.tournament_teams || []).map((tt) => tt.team_id);
                  const registeredTeams = registeredIds.map((id) => teamMap[id]).filter(Boolean);
                  const isExpanded = expandedTour === tour.id;
                  return (
                    <div key={tour.id} style={styles.card}>
                      <div style={styles.cardHeadRow}>
                        {tour.banner_url && <img src={tour.banner_url} alt={tour.name} style={styles.tourBannerSm} />}
                        <div style={{ flex: 1 }}>
                          <div style={styles.cardTitle}>
                            {tour.name} <span style={{ color: "#8C7876", fontSize: 12 }}>· {MODE_LABEL[tour.mode]}</span>
                          </div>
                          <div style={styles.cardMeta}>
                            {registeredTeams.length}
                            {tour.max_teams ? ` / ${tour.max_teams}` : ""} команд · {STATUS_LABEL[tour.status]}
                          </div>
                          {tour.prize_pool && (
                            <div style={{ ...styles.prizeRow, marginTop: 6 }}>
                              <Trophy size={12} color="#D9414C" /> {tour.prize_pool}
                            </div>
                          )}
                        </div>
                        <button style={styles.iconBtn} onClick={() => setConfirmDeleteId(tour.id === confirmDeleteId ? null : tour.id)}>
                          <Trash2 size={14} color="#FF5A5A" />
                        </button>
                      </div>

                      {confirmDeleteId === tour.id && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button style={{ ...styles.ghostBtnSm, borderColor: "#FF5A5A", color: "#FF5A5A" }} onClick={() => deleteTournament(tour.id)}>
                            Подтвердить удаление
                          </button>
                          <button style={styles.ghostBtnSm} onClick={() => setConfirmDeleteId(null)}>
                            Отмена
                          </button>
                        </div>
                      )}

                      {registeredTeams.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                          {registeredTeams.map((t) => (
                            <span key={t.id} style={{ ...styles.memberChip, display: "flex", alignItems: "center", gap: 6 }}>
                              {teamLabel(t)}
                              {tour.status === "registration" && (
                                <X
                                  size={11}
                                  color="#FF5A5A"
                                  style={{ cursor: "pointer" }}
                                  onClick={() => unregisterTeam(tour.id, t.id)}
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {tour.status === "registration" && (
                          <button className="nur-btn" style={styles.accentBtnSm} disabled={registeredTeams.length < 2} onClick={() => generateBracket(tour.id)}>
                            Сформировать сетку
                          </button>
                        )}
                        {tour.status === "bracket_ready" && (
                          <button className="nur-btn" style={styles.accentBtnSm} onClick={() => startTournament(tour.id)}>
                            Начать турнир
                          </button>
                        )}
                        {tour.status !== "registration" && (
                          <button className="nur-btn" style={styles.ghostBtnSm} onClick={() => toggleExpand(tour.id, true)}>
                            {isExpanded ? "Скрыть сетку" : "Управлять сеткой"}
                          </button>
                        )}
                      </div>

                      {isExpanded && renderBracket(tour.id, expandedRounds, true)}
                    </div>
                  );
                })}
                </>
                )}

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Обращения в поддержку</div>
                  <div style={{ ...styles.hint, marginTop: 8, marginBottom: 12 }}>
                    {supportTickets.length > 0 ? `Активных обращений: ${supportTickets.length}` : "Пока никто не писал в поддержку."}
                  </div>
                  <button
                    className="nur-btn"
                    style={styles.accentBtnSm}
                    onClick={() => {
                      setActiveTab("support");
                      refreshSupportTickets();
                      refreshSupportArchive();
                    }}
                  >
                    <LifeBuoy size={13} /> Открыть страницу поддержки
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "support" && (
          <div style={styles.stack}>
            <div style={styles.sectionHead}>
              <LifeBuoy size={16} color="#D9414C" />
              <span style={styles.sectionTitle}>ПОДДЕРЖКА</span>
            </div>

            {!session && <div style={styles.emptyState}>Войдите в профиль, чтобы получить доступ.</div>}
            {session && !profile?.is_admin && !profile?.is_moderator && (
              <div style={styles.emptyState}>У вашего аккаунта нет прав администратора или модератора.</div>
            )}

            {session && (profile?.is_admin || profile?.is_moderator) && (
              <div style={styles.supportPageGrid}>
                <div style={styles.supportPageSidebar}>
                  <div style={styles.supportPageTabs}>
                    <button
                      style={{ ...styles.supportPageTabBtn, ...(supportPageTab === "active" ? styles.supportPageTabBtnActive : {}) }}
                      onClick={() => {
                        setSupportPageTab("active");
                        refreshSupportTickets();
                      }}
                    >
                      Активные{supportTickets.length ? ` (${supportTickets.length})` : ""}
                    </button>
                    <button
                      style={{ ...styles.supportPageTabBtn, ...(supportPageTab === "archive" ? styles.supportPageTabBtnActive : {}) }}
                      onClick={() => {
                        setSupportPageTab("archive");
                        refreshSupportArchive();
                      }}
                    >
                      Архив
                    </button>
                  </div>
                  <div className="nur-chat-scroll" style={styles.supportPageList}>
                    {supportPageTab === "active" ? (
                      <>
                        {supportTickets.length === 0 && <div style={{ ...styles.hint, padding: 14 }}>Пока никто не писал.</div>}
                        {supportTickets.map((t) => (
                          <div
                            key={t.ticket_id}
                            style={{ ...styles.supportPageRow, ...(supportTicketId === t.ticket_id ? styles.supportPageRowActive : {}) }}
                            onClick={() => openSupportChat(t)}
                          >
                            <div style={{ position: "relative" }}>
                              <div style={styles.avatarWrapSm}>
                                {t.avatar_url ? (
                                  <img src={t.avatar_url} alt="" style={styles.avatarImgSm} />
                                ) : (
                                  <div style={styles.avatarFallbackSm}>{(t.username || "?")[0].toUpperCase()}</div>
                                )}
                              </div>
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: -1,
                                  right: -1,
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  border: "2px solid #1C1416",
                                  background: onlineUserIds.has(t.user_id) ? "#6FBF73" : "#5A2E33",
                                }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, color: "#F3ECEA" }}>{t.username}</div>
                              <div style={{ ...styles.hint, fontSize: 10.5 }}>{formatDateTime(t.last_at)}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {supportArchive.length === 0 && <div style={{ ...styles.hint, padding: 14 }}>Архив пуст.</div>}
                        {supportArchive.map((t) => (
                          <div
                            key={t.ticket_id}
                            style={{ ...styles.supportPageRow, ...(supportTicketId === t.ticket_id ? styles.supportPageRowActive : {}) }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openArchiveChat(t)}>
                              <div style={styles.avatarWrapSm}>
                                {t.avatar_url ? (
                                  <img src={t.avatar_url} alt="" style={styles.avatarImgSm} />
                                ) : (
                                  <div style={styles.avatarFallbackSm}>{(t.username || "?")[0].toUpperCase()}</div>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: "#F3ECEA" }}>{t.username}</div>
                                <div style={{ ...styles.hint, fontSize: 10.5 }}>закрыт {formatDateTime(t.closed_at)}</div>
                              </div>
                            </div>
                            {profile?.is_admin && (
                              confirmDeleteTicketId === t.ticket_id ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    style={styles.iconBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteArchivedTicket(t.ticket_id);
                                    }}
                                    title="Подтвердить удаление"
                                  >
                                    <Check size={12} color="#FF5A5A" />
                                  </button>
                                  <button
                                    style={styles.iconBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteTicketId(null);
                                    }}
                                    title="Отмена"
                                  >
                                    <X size={12} color="#AE9B99" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  style={styles.iconBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteTicketId(t.ticket_id);
                                  }}
                                  title="Удалить из архива"
                                >
                                  <Trash2 size={12} color="#FF5A5A" />
                                </button>
                              )
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div style={styles.supportPageConv}>
                  {!supportTarget ? (
                    <div style={{ ...styles.hint, margin: "auto" }}>Выберите обращение слева.</div>
                  ) : (
                    <>
                      <div style={styles.supportPageConvHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={styles.avatarWrapSm}>
                            <div style={styles.avatarFallbackSm}>{(supportTarget.username || "?")[0].toUpperCase()}</div>
                          </div>
                          <span style={{ color: "#F3ECEA", fontSize: 14, fontWeight: 600 }}>{supportTarget.username}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="nur-btn" style={styles.ghostBtnSm} onClick={() => openUserProfile(supportTarget)}>
                            Профиль
                          </button>
                          {supportTicketStatus === "open" &&
                            (confirmCloseTicket ? (
                              <>
                                <button style={{ ...styles.ghostBtnSm, borderColor: "#FF5A5A", color: "#FF5A5A" }} onClick={closeSupportTicket}>
                                  Подтвердить
                                </button>
                                <button style={styles.ghostBtnSm} onClick={() => setConfirmCloseTicket(false)}>
                                  Отмена
                                </button>
                              </>
                            ) : (
                              <button style={{ ...styles.ghostBtnSm, borderColor: "#FF5A5A", color: "#FF5A5A" }} onClick={() => setConfirmCloseTicket(true)}>
                                Закрыть тикет
                              </button>
                            ))}
                        </div>
                      </div>
                      <div ref={supportMessagesRef} className="nur-chat-scroll" style={styles.supportPageMessages}>
                        {supportMessages.map((m) => {
                          const mine = m.sender_id === session?.user.id;
                          return (
                            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                              <div style={{ ...styles.chatBubble, ...(mine ? styles.chatBubbleMine : styles.chatBubbleTheirs) }}>{m.content}</div>
                            </div>
                          );
                        })}
                      </div>
                      {supportTicketStatus === "open" ? (
                        <div style={styles.chatInputRow}>
                          <input
                            className="nur-in"
                            placeholder="Сообщение…"
                            value={supportInput}
                            onChange={(e) => setSupportInput(e.target.value)}
                            onKeyDown={(e) => {
                              playTypeSound(e);
                              if (e.key === "Enter") sendSupportMessage();
                            }}
                            style={{ ...styles.input, flex: 1 }}
                          />
                          <button className="nur-btn" style={styles.accentBtnSm} onClick={sendSupportMessage}>
                            Отпр.
                          </button>
                        </div>
                      ) : (
                        <div style={{ ...styles.hint, textAlign: "center", padding: "12px 14px", borderTop: "1px solid #3D2226" }}>
                          Тикет закрыт — переписка доступна только для просмотра
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </>
        )}

        {viewingUser &&
          (() => {
            const userTeams = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === viewingUser.username));
            const userTournaments = getUserTournamentHistory(viewingUser.username);
            const userMatches = getUserMatchHistory(viewingUser.username);
            const titleCount = userTournaments.filter((t) => t.isChampion).length;
            const isOwnProfile = session && viewingUser.id === session.user.id;
            const canSeeFull = isOwnProfile || profile?.is_admin || !viewingUser.is_closed;
            return (
              <div>
                <button style={{ ...styles.ghostBtnSm, marginBottom: 14 }} onClick={() => setViewingUser(null)}>
                  ← Назад к турнирам
                </button>

                {!canSeeFull ? (
                  <div style={{ background: "#170D0E", border: "1px solid #3D2226", borderRadius: 12, padding: "50px 20px", textAlign: "center" }}>
                    <ShieldAlert size={28} color="#8C7876" />
                    <div style={{ color: "#F3ECEA", fontSize: 17, fontWeight: 700, marginTop: 12, fontFamily: "'Anton', sans-serif", letterSpacing: 1 }}>
                      АНКЕТА ЗАКРЫТА
                    </div>
                    <div style={{ ...styles.hint, marginTop: 8 }}>Пользователь {viewingUser.username} скрыл свой профиль.</div>
                  </div>
                ) : (
                <>
                <div style={{ background: "#150F10", border: "1px solid #3D2226", overflow: "hidden" }}>
                  <div
                    style={{
                      height: 150,
                      background: "linear-gradient(115deg, #3A1519 0%, #1F0F11 50%, #150F10 100%)",
                      position: "relative",
                    }}
                  >
                    {viewingUser.banner_url && (
                      <img src={viewingUser.banner_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "repeating-linear-gradient(118deg, transparent 0 18px, rgba(217,65,76,0.07) 18px 19px)",
                        pointerEvents: "none",
                      }}
                    />
                    <div style={{ position: "absolute", top: 16, left: 22, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 3, color: "#E8A33D" }}>
                      NUR // PLAYER CARD
                    </div>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#3B7DD8", opacity: 0.1, clipPath: "polygon(100% 0, 100% 100%, 0 0)" }} />
                  </div>

                  <div style={{ padding: "0 24px 22px", position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: -44, flexWrap: "wrap" }}>
                      <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0, filter: "drop-shadow(0 6px 14px rgba(0,0,0,.6))" }}>
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
                            background: "#D9414C",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "92%",
                              height: "92%",
                              clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
                              background: "linear-gradient(140deg, #2E1B1E, #16100F)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            {viewingUser.avatar_url ? (
                              <img src={viewingUser.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, color: "#D9414C" }}>
                                {(viewingUser.username || "?")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            position: "absolute",
                            bottom: -4,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: onlineUserIds.has(viewingUser.id) ? "#14301B" : "#2A1416",
                            color: onlineUserIds.has(viewingUser.id) ? "#6FBF73" : "#8C7876",
                            border: `1px solid ${onlineUserIds.has(viewingUser.id) ? "#24512E" : "#3D2226"}`,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            letterSpacing: 1,
                            padding: "3px 9px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {onlineUserIds.has(viewingUser.id) ? "В СЕТИ" : "НЕ В СЕТИ"}
                        </div>
                      </div>

                      <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 32, letterSpacing: 0.5, lineHeight: 1 }}>{viewingUser.username}</span>
                          {profile?.is_admin && viewingUser.id === session?.user.id && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 1.5, background: "#3A2116", color: "#E8A33D", padding: "4px 10px", borderLeft: "2px solid #E8A33D" }}>
                              АДМИНИСТРАТОР
                            </span>
                          )}
                          {viewingUser.is_moderator && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 1.5, background: "#3A2116", color: "#E8A33D", padding: "4px 10px", borderLeft: "2px solid #E8A33D" }}>
                              МОДЕРАТОР
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, paddingBottom: 4, flexWrap: "wrap" }}>
                        {session && viewingUser.id !== session.user.id && (
                          <>
                            {friends.some((f) => f.id === viewingUser.id) && (
                              <button className="nur-btn" style={styles.profileActionBtn} onClick={() => openChat(viewingUser)}>
                                Написать
                              </button>
                            )}
                            {friends.some((f) => f.id === viewingUser.id) ? (
                              <span style={{ ...styles.profileActionBtn, color: "#7A6668", cursor: "default" }}>В друзьях</span>
                            ) : sentPendingRequests.some((r) => r.id === viewingUser.id) ? (
                              <span style={{ ...styles.profileActionBtn, color: "#7A6668", cursor: "default" }}>Заявка отправлена</span>
                            ) : incomingRequests.some((r) => r.id === viewingUser.id) ? (
                              <span style={{ ...styles.profileActionBtn, color: "#7A6668", cursor: "default" }}>Ждёт вашего ответа</span>
                            ) : (
                              <button className="nur-btn" style={{ ...styles.profileActionBtn, ...styles.profileActionBtnPrimary }} onClick={() => sendFriendRequest(viewingUser.id)}>
                                + В друзья
                              </button>
                            )}
                          </>
                        )}
                        {profile?.is_admin && viewingUser.id !== session?.user.id && (
                          <>
                            <button className="nur-btn" style={styles.profileActionBtn} onClick={() => toggleModerator(viewingUser)}>
                              {viewingUser.is_moderator ? "Снять модератора" : "Выдать модератора"}
                            </button>
                            <button className="nur-btn" style={styles.profileActionBtn} onClick={() => toggleClosedProfile(viewingUser)}>
                              {viewingUser.is_closed ? "Открыть анкету" : "Закрыть анкету"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const userTeamIds = userTeams.map((t) => t.id);
                      let bestRank = null;
                      [leaderboard5x5, leaderboard2x2].forEach((board) => {
                        board.forEach((entry, idx) => {
                          if (userTeamIds.includes(entry.id)) {
                            const rank = idx + 1;
                            if (bestRank === null || rank < bestRank) bestRank = rank;
                          }
                        });
                      });
                      const winCount = userMatches.filter((m) => m.won).length;
                      const stats = [
                        { num: bestRank ? `#${bestRank}` : "—", label: "Место в топе", gold: false },
                        { num: titleCount, label: "Титулов", gold: true },
                        { num: winCount, label: "Побед", gold: false },
                        { num: userTeams.length, label: "Команд", gold: false },
                      ];
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginTop: 20, border: "1px solid #2A1B1D" }}>
                          {stats.map((s, i) => (
                            <div key={s.label} style={{ padding: "13px 14px", borderRight: i < 3 ? "1px solid #2A1B1D" : "none", position: "relative" }}>
                              <div style={{ position: "absolute", top: 0, left: 0, width: 18, height: 2, background: s.gold ? "#E8A33D" : "#D9414C" }} />
                              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, lineHeight: 1, color: s.gold ? "#E8A33D" : "#F3ECEA" }}>{s.num}</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 1, color: "#7A6668", marginTop: 6, textTransform: "uppercase" }}>
                                {s.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ display: "flex", marginTop: 18, borderBottom: "1px solid #2A1B1D" }}>
                  {[
                    { id: "overview", label: "Обзор" },
                    { id: "matches", label: "Матчи" },
                    { id: "teams", label: "Команды" },
                  ].map((tb) => (
                    <div
                      key={tb.id}
                      onClick={() => setViewingProfileTab(tb.id)}
                      style={{
                        padding: "11px 18px",
                        fontSize: 12.5,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        marginBottom: -1,
                        color: viewingProfileTab === tb.id ? "#F3ECEA" : "#7A6668",
                        fontWeight: viewingProfileTab === tb.id ? 600 : 400,
                        borderBottom: viewingProfileTab === tb.id ? "2px solid #D9414C" : "2px solid transparent",
                      }}
                    >
                      {tb.label}
                    </div>
                  ))}
                  {isOwnProfile && (
                    <div
                      onClick={() => {
                        setActiveTab("profile");
                        setViewingUser(null);
                      }}
                      style={{ marginLeft: "auto", padding: "11px 18px", fontSize: 12.5, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer", color: "#5A4548" }}
                    >
                      Настройки
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 268px", gap: 16, marginTop: 16, alignItems: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                    {viewingProfileTab === "overview" && (
                      <div style={styles.profilePanel}>
                        <div style={styles.profilePanelHead}>
                          <div style={styles.profilePanelTitle}>О себе</div>
                        </div>
                        <div style={{ padding: "14px 16px" }}>
                          <div style={{ fontSize: 13.5, color: viewingUser.bio ? "#C4B4B2" : "#7A6668", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                            {viewingUser.bio || "Пользователь ничего не написал о себе."}
                          </div>
                        </div>
                      </div>
                    )}

                    {(viewingProfileTab === "overview" || viewingProfileTab === "matches") && (
                      <div style={styles.profilePanel}>
                        <div style={styles.profilePanelHead}>
                          <div style={styles.profilePanelTitle}>{viewingProfileTab === "matches" ? "Матчи" : "Последние матчи"}</div>
                          <div style={styles.profilePanelCount}>{userMatches.length}</div>
                        </div>
                        <div style={{ padding: "0 16px 14px" }}>
                          {userMatches.length === 0 ? (
                            <div style={{ ...styles.hint, padding: "14px 0" }}>Пока не сыграл ни одного матча.</div>
                          ) : (
                            (viewingProfileTab === "matches" ? userMatches : userMatches.slice(0, 5)).map((m, i, arr) => (
                              <div
                                key={m.id}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid #241618" : "none" }}
                              >
                                <div
                                  style={{
                                    width: 30,
                                    height: 30,
                                    flexShrink: 0,
                                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontFamily: "'Anton', sans-serif",
                                    fontSize: 12,
                                    background: !m.decided ? "#241618" : m.won ? "#17331D" : "#331719",
                                    color: !m.decided ? "#7A6668" : m.won ? "#6FBF73" : "#FF8A8A",
                                  }}
                                >
                                  {!m.decided ? "•" : m.won ? "W" : "L"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.tourName}</div>
                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#7A6668", marginTop: 3 }}>vs {m.oppName}</div>
                                </div>
                                {m.decided && m.myScore != null && m.oppScore != null ? (
                                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 15, letterSpacing: 1 }}>
                                    <span style={{ color: m.won ? "#6FBF73" : "#7A6668" }}>{m.myScore}</span>
                                    <span style={{ color: "#7A6668" }}> : </span>
                                    <span style={{ color: m.won ? "#7A6668" : "#6FBF73" }}>{m.oppScore}</span>
                                  </div>
                                ) : (
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#7A6668" }}>{m.decided ? "—" : "идёт"}</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {viewingProfileTab === "teams" && (
                      <div style={styles.profilePanel}>
                        <div style={styles.profilePanelHead}>
                          <div style={styles.profilePanelTitle}>Команды</div>
                          <div style={styles.profilePanelCount}>{userTeams.length}</div>
                        </div>
                        <div style={{ padding: "14px 16px" }}>
                          {userTeams.length === 0 ? (
                            <div style={styles.hint}>Пока не состоит ни в одной команде.</div>
                          ) : (
                            userTeams.map((t) => (
                              <div key={t.id} style={{ borderLeft: "2px solid #2A1B1D", paddingLeft: 12, marginBottom: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {t.logo_url ? (
                                    <img src={t.logo_url} alt="" style={{ ...styles.teamLogoShape, objectFit: "cover" }} />
                                  ) : (
                                    <div style={{ ...styles.teamLogoShape, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Anton', sans-serif", color: "#D9414C", fontSize: 14 }}>
                                      {(t.name || "?")[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{teamLabel(t)}</div>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7A6668", marginTop: 2 }}>
                                      {MODE_LABEL[t.mode]} · {(t.team_members || []).length}/{t.max_size}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                  {(t.team_members || []).map((mem) => (
                                    <div
                                      key={mem.member_name}
                                      style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 12.5 }}
                                      onClick={() => openTeamMemberProfile(mem.member_name)}
                                    >
                                      <div style={styles.hexAvatarSm}>{(mem.member_name || "?")[0].toUpperCase()}</div>
                                      <span style={{ flex: 1 }}>{mem.member_name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={styles.profilePanel}>
                      <div style={styles.profilePanelHead}>
                        <div style={styles.profilePanelTitle}>Команда</div>
                      </div>
                      <div style={{ padding: "14px 16px" }}>
                        {userTeams.length === 0 ? (
                          <div style={styles.hint}>Нет команды.</div>
                        ) : (
                          userTeams.map((t, ti) => (
                            <div key={t.id} style={{ borderLeft: "2px solid #2A1B1D", paddingLeft: 12, marginBottom: ti < userTeams.length - 1 ? 14 : 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {t.logo_url ? (
                                  <img src={t.logo_url} alt="" style={{ ...styles.teamLogoShape, objectFit: "cover" }} />
                                ) : (
                                  <div style={{ ...styles.teamLogoShape, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Anton', sans-serif", color: "#D9414C", fontSize: 14 }}>
                                    {(t.name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamLabel(t)}</div>
                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7A6668", marginTop: 2 }}>
                                    {MODE_LABEL[t.mode]} · {(t.team_members || []).length}/{t.max_size}
                                  </div>
                                </div>
                              </div>
                              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                {(t.team_members || []).map((mem) => (
                                  <div
                                    key={mem.member_name}
                                    style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 12.5 }}
                                    onClick={() => openTeamMemberProfile(mem.member_name)}
                                  >
                                    <div style={styles.hexAvatarSm}>{(mem.member_name || "?")[0].toUpperCase()}</div>
                                    <span style={{ flex: 1 }}>{mem.member_name}</span>
                                    {mem.member_name === viewingUser.username && userTeams.some((x) => x.id === t.id && x.owner_id === viewingUser.id) && (
                                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#E8A33D", border: "1px solid #5A3A1E", padding: "1px 5px" }}>КЭП</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={styles.profilePanel}>
                      <div style={styles.profilePanelHead}>
                        <div style={styles.profilePanelTitle}>Друзья</div>
                        <div style={styles.profilePanelCount}>
                          {viewingUserFriends.filter((fr) => onlineUserIds.has(fr.id)).length} / {viewingUserFriends.length} онлайн
                        </div>
                      </div>
                      <div style={{ padding: "6px 16px 14px" }}>
                        {viewingUserFriendsLoading ? (
                          <div style={{ ...styles.hint, padding: "8px 0" }}>Загрузка…</div>
                        ) : viewingUserFriends.length === 0 ? (
                          <div style={{ ...styles.hint, padding: "8px 0" }}>Пока никого не добавили.</div>
                        ) : (
                          viewingUserFriends.map((fr) => (
                            <div key={fr.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }} onClick={() => openUserProfile(fr)}>
                              <div style={styles.hexAvatarSm}>
                                {fr.avatar_url ? (
                                  <img src={fr.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  (fr.username || "?")[0].toUpperCase()
                                )}
                              </div>
                              <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fr.username}</span>
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: "50%",
                                  flexShrink: 0,
                                  background: onlineUserIds.has(fr.id) ? "#6FBF73" : "#4A2529",
                                  boxShadow: onlineUserIds.has(fr.id) ? "0 0 6px #6FBF7355" : "none",
                                }}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </>

                )}
              </div>
            );
          })()}
      </div>

      {(activeTab === "tournaments" || activeTab === "tourlist") &&
        expandedTour &&
        expandedRounds &&
        (() => {
          const modalTour = tournaments.find((t) => t.id === expandedTour);
          if (!modalTour) return null;
          return (
            <div style={styles.modalBackdrop} onClick={() => setExpandedTour(null)}>
              <div style={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    opacity: 0.6,
                    backgroundImage:
                      "repeating-linear-gradient(115deg, transparent 0px, transparent 17px, rgba(217,65,76,0.05) 17px, rgba(217,65,76,0.05) 18px)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: -70,
                    bottom: -70,
                    width: 280,
                    height: 280,
                    background: "#D9414C",
                    opacity: 0.16,
                    clipPath: "polygon(0 100%, 100% 100%, 0 0)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: -70,
                    top: -70,
                    width: 280,
                    height: 280,
                    background: "#3B7DD8",
                    opacity: 0.14,
                    clipPath: "polygon(100% 0, 100% 100%, 0 0)",
                    pointerEvents: "none",
                  }}
                />
                <div className="nur-menu-smoke" />
                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={styles.modalHeader}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 26, letterSpacing: 1 }}>
                          <span style={{ color: "#F3ECEA" }}>NUR </span>
                          <span style={{ color: "#D9414C" }}>TOURNAMENTS</span>
                        </div>
                        <div style={{ color: "#AE9B99", fontSize: 12, marginTop: 4 }}>
                          {modalTour.name} · {MODE_LABEL[modalTour.mode]}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          style={styles.iconBtn}
                          title="Скачать сетку как картинку"
                          onClick={() => downloadBracketImage(modalTour.name, MODE_LABEL[modalTour.mode])}
                        >
                          <Download size={15} color="#AE9B99" />
                        </button>
                        <button style={styles.iconBtn} onClick={() => setExpandedTour(null)}>
                          <X size={16} color="#AE9B99" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={styles.modalBody}>{renderBracket(modalTour.id, expandedRounds, !!profile?.is_admin, bracketCaptureRef)}</div>
                </div>
              </div>
            </div>
          );
        })()}

      {activeChatFriend && activeTab !== "dialogs" && (
        <div style={{ ...styles.chatPanel, transform: `translate(${chatDrag.x}px, ${chatDrag.y}px)` }}>
          <div style={{ ...styles.chatHeader, cursor: "grab", userSelect: "none" }} onMouseDown={onChatHeaderMouseDown}>
            <div style={styles.avatarWrapSm}>
              {activeChatFriend.avatar_url ? (
                <img src={activeChatFriend.avatar_url} alt="" style={styles.avatarImgSm} />
              ) : (
                <div style={styles.avatarFallbackSm}>{(activeChatFriend.username || "?")[0].toUpperCase()}</div>
              )}
            </div>
            <span style={{ flex: 1, color: "#F3ECEA", fontSize: 13.5, fontWeight: 600 }}>{activeChatFriend.username}</span>
            <button style={styles.iconBtn} onMouseDown={(e) => e.stopPropagation()} onClick={() => setActiveChatFriend(null)}>
              <X size={14} color="#AE9B99" />
            </button>
          </div>
          <div ref={chatMessagesRef} className="nur-chat-scroll" style={styles.chatMessages}>
            {chatMessages.length === 0 && <div style={{ ...styles.hint, textAlign: "center", marginTop: 20 }}>Начните переписку</div>}
            {chatMessages.map((m) => {
              const mine = m.sender_id === session?.user.id;
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ ...styles.chatBubble, ...(mine ? styles.chatBubbleMine : styles.chatBubbleTheirs) }}>{m.content}</div>
                </div>
              );
            })}
          </div>
          <div style={styles.chatInputRow}>
            <input
              className="nur-in"
              placeholder="Сообщение…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                playTypeSound(e);
                if (e.key === "Enter") sendChatMessage();
              }}
              style={{ ...styles.input, flex: 1 }}
            />
            <button className="nur-btn" style={styles.accentBtnSm} onClick={sendChatMessage}>
              Отпр.
            </button>
          </div>
        </div>
      )}

      {(() => {
        if (!currentUsername) return null;
        const myTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === currentUsername)).map((t) => t.id);
        const myReadyCheck = readyChecks.find((rc) => {
          if (rc.status !== "pending") return false;
          const isTeam1 = myTeamIds.includes(rc.team1_id);
          const isTeam2 = myTeamIds.includes(rc.team2_id);
          if (!isTeam1 && !isTeam2) return false;
          const alreadyAccepted = isTeam1 ? !!rc.team1_accepted_at : !!rc.team2_accepted_at;
          return !alreadyAccepted;
        });
        if (!myReadyCheck) return null;
        const isTeam1 = myTeamIds.includes(myReadyCheck.team1_id);
        const myTeam = teamMap[isTeam1 ? myReadyCheck.team1_id : myReadyCheck.team2_id];
        const oppTeam = teamMap[isTeam1 ? myReadyCheck.team2_id : myReadyCheck.team1_id];
        const tour = tournaments.find((t) => t.id === myReadyCheck.tournament_id);
        const secondsLeft = Math.max(0, Math.floor((new Date(myReadyCheck.deadline).getTime() - readyCheckNow) / 1000));
        const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
        const ss = String(secondsLeft % 60).padStart(2, "0");
        return (
          <div style={styles.readyCheckOverlay}>
            <div style={{ ...styles.readyCheckCard, position: "relative" }}>
              {profile?.is_admin && (
                <button
                  style={{ position: "absolute", top: 10, right: 10, ...styles.iconBtn }}
                  title="Отменить (админ)"
                  onClick={() => cancelReadyCheck(myReadyCheck)}
                >
                  <X size={13} color="#AE9B99" />
                </button>
              )}
              <div style={{ ...styles.hint, marginBottom: 6 }}>{tour ? tour.name : "Турнир"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F3ECEA", marginBottom: 4, textAlign: "center" }}>
                {myTeam ? teamLabel(myTeam) : "Ваша команда"} vs {oppTeam ? teamLabel(oppTeam) : "Соперник"}
              </div>
              <div style={{ ...styles.hint, marginBottom: 16, textAlign: "center" }}>Матч готов начаться — подтвердите участие</div>
              <div style={styles.readyCheckTimer}>
                {mm}:{ss}
              </div>
              <button className="nur-btn" style={{ ...styles.accentBtn, marginTop: 18, width: "100%", justifyContent: "center" }} onClick={() => acceptReadyCheck(myReadyCheck)}>
                Принять
              </button>
              <div style={{ ...styles.hint, marginTop: 10, fontSize: 11, textAlign: "center" }}>
                Если не подтвердить за отведённое время — команде будет засчитано техническое поражение.
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        if (!currentUsername) return null;
        const myTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === currentUsername)).map((t) => t.id);
        const myVetoRaw = matchVetoes.find((v) => myTeamIds.includes(v.team1_id) || myTeamIds.includes(v.team2_id));
        if (!myVetoRaw) return null;
        if (dismissedVetoIds.has(myVetoRaw.id)) {
          // Игрок сам закрыл эту карточку — не показываем оверлей, но
          // даём заметную плавающую кнопку, чтобы можно было вернуться,
          // если закрыл случайно (сама заявка на бан карт никуда не делась).
          return (
            <button
              className="nur-btn"
              style={{
                position: "fixed",
                left: 20,
                bottom: 90,
                zIndex: 60,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #D9414C, #B7222C)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                border: "none",
                boxShadow: "0 8px 24px rgba(217,65,76,0.45)",
              }}
              onClick={() => setDismissedVetoIds((prev) => { const next = new Set(prev); next.delete(myVetoRaw.id); return next; })}
            >
              <ScrollText size={15} /> Вернуться к выбору карты
            </button>
          );
        }
        const myVeto = myVetoRaw;
        const myTeam = teams.find((t) => myTeamIds.includes(t.id) && (t.id === myVeto.team1_id || t.id === myVeto.team2_id));
        const isCaptain = myTeam && myTeam.owner_id === session?.user.id;
        const myTurn = isCaptain && myVeto.current_turn_team_id === myTeam.id;
        const oppTeamId = myTeam?.id === myVeto.team1_id ? myVeto.team2_id : myVeto.team1_id;
        const oppTeam = teamMap[oppTeamId];
        const turnTeam = teamMap[myVeto.current_turn_team_id];
        return (
          <div style={styles.readyCheckOverlay}>
            <VetoBackground />
            <div style={{ ...styles.readyCheckCard, maxWidth: "none", width: "100%", background: "transparent", border: "none", boxShadow: "none", padding: 0, position: "relative" }}>
              <button
                style={{ position: "absolute", top: -6, right: 24, zIndex: 2, ...styles.iconBtn }}
                title="Закрыть (можно будет вернуться)"
                onClick={() => setDismissedVetoIds((prev) => new Set(prev).add(myVeto.id))}
              >
                <X size={13} color="#AE9B99" />
              </button>
              {profile?.is_admin && (
                <button
                  style={{ position: "absolute", top: -6, right: -6, zIndex: 2, ...styles.iconBtn }}
                  title="Отменить (админ)"
                  onClick={() => cancelVeto(myVeto)}
                >
                  <Trash2 size={13} color="#AE9B99" />
                </button>
              )}
              <div
                style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: 30,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#F3ECEA",
                  marginBottom: 2,
                  textAlign: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {myTeam ? teamLabel(myTeam) : "Вы"} <span style={{ color: "#D9414C", margin: "0 12px" }}>VS</span> {oppTeam ? teamLabel(oppTeam) : "Соперник"}
              </div>
              {myVeto.status === "completed" ? (
                <div style={{ ...styles.vetoTurnLabel, marginBottom: 40 }}>Карта определена</div>
              ) : (
                <div style={{ ...styles.vetoTurnLabel, marginBottom: 40 }}>
                  {!isCaptain
                    ? `Банит капитан · сейчас ход: ${turnTeam ? teamLabel(turnTeam) : "…"}`
                    : myTurn
                    ? "Ваш ход — забаньте карту"
                    : `Сейчас банит: ${turnTeam ? teamLabel(turnTeam) : "…"}`}
                  {myVeto.turn_deadline && (
                    <span style={{ marginLeft: 10, color: "#E8A33D" }}>
                      · {Math.max(0, Math.ceil((new Date(myVeto.turn_deadline).getTime() - readyCheckNow) / 1000))}с
                    </span>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "flex-end", padding: "10px 4px 16px", position: "relative", zIndex: 1, width: "100%", maxWidth: 1360, margin: "0 auto" }}>
                {MAP_POOL.map((mapKey) => {
                  const banned = !myVeto.maps_remaining.includes(mapKey);
                  const isDecider = myVeto.status === "completed" && myVeto.final_map === mapKey;
                  const clickable = myTurn && !banned && myVeto.status !== "completed";
                  const banEntry = myVeto.banned_maps.find((b) => b.map === mapKey);
                  const banTeam = banEntry ? teamMap[banEntry.team_id] : null;
                  const isGoldBadge = banTeam && banTeam.id === myVeto.team1_id;
                  const isBanning = banningMapKey === mapKey;
                  return (
                    <div
                      key={mapKey}
                      className={[
                        "nur-veto-card",
                        clickable && !isBanning ? "pickable" : "",
                        isBanning ? "banning" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => {
                        if (!clickable || banningMapKey) return;
                        setBanningMapKey(mapKey);
                        setTimeout(() => {
                          banMap(myVeto, mapKey);
                          setBanningMapKey(null);
                        }, 480);
                      }}
                      style={{
                        ...styles.vetoCard,
                        cursor: clickable && !isBanning ? "pointer" : "default",
                        filter: banned ? "grayscale(0.9) brightness(0.3)" : "none",
                        borderColor: isDecider ? "#E8A33D" : clickable ? "#4A2C2F" : "#3D2226",
                        boxShadow: isDecider ? "0 0 44px rgba(232,163,61,0.55), 0 22px 50px rgba(0,0,0,0.7)" : "none",
                        transform: isDecider ? "skewX(-7deg) translateY(-16px) scale(1.04)" : "skewX(-7deg)",
                      }}
                    >
                      {/* фон-слой: намеренно НЕ компенсирует наклон, иначе по углам
                          рамки остаются пустые треугольники */}
                      <div
                        style={{
                          position: "absolute",
                          inset: "-6% -14%",
                          background: mapImages[mapKey] ? `url(${mapImages[mapKey]}) center/cover` : MAP_GRADIENT[mapKey],
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.93) 100%)",
                        }}
                      />
                      {isBanning && (
                        <>
                          <div className="nur-veto-flash" />
                          <div className="nur-veto-sweep" />
                        </>
                      )}
                      {banTeam && !isBanning && (
                        <div
                          className="nur-veto-badge-anim"
                          style={{
                            ...styles.vetoTeamBadge,
                            borderColor: isGoldBadge ? "#E8A33D" : "#D9414C",
                            boxShadow: isGoldBadge ? "0 0 26px rgba(232,163,61,0.5)" : "0 0 26px rgba(217,65,76,0.5)",
                          }}
                        >
                          {(banTeam.tag || teamLabel(banTeam)).slice(0, 4).toUpperCase()}
                        </div>
                      )}
                      {/* текст компенсирует наклон карточки, чтобы стоять ровно */}
                      <div style={{ position: "relative", padding: "14px 10px 20px", textAlign: "center", transform: "skewX(7deg)" }}>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: 12,
                            letterSpacing: 3.5,
                            textTransform: "uppercase",
                            color: banned ? "#6b5a58" : isDecider ? "#fff" : "#E8A33D",
                          }}
                        >
                          {isDecider ? "Играем" : banned ? "Бан" : "Забанить"}
                        </div>
                        <div
                          style={{
                            fontFamily: "'Anton', sans-serif",
                            fontSize: 24,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginTop: 4,
                            color: banned ? "#6b5a58" : "#fff",
                            textDecoration: banned ? "line-through" : "none",
                            textShadow: "0 2px 14px rgba(0,0,0,0.7)",
                          }}
                        >
                          {MAP_LABEL[mapKey]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        if (!currentUsername) return null;
        const myTeamIds = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === currentUsername)).map((t) => t.id);
        const myLobbyRaw = matchLobbies.find(
          (l) => l.status !== "finished" && (myTeamIds.includes(l.team1_id) || myTeamIds.includes(l.team2_id))
        );
        if (!myLobbyRaw) return null;
        if (dismissedLobbyIds.has(myLobbyRaw.id)) {
          // Игрок закрыл карточку со ссылкой/паролем на сервер — даём
          // заметную плавающую кнопку, чтобы вернуться к ней. Стоит НАД
          // кнопкой веток (bottom: 150 vs 90), чтобы обе помещались
          // одновременно, если игрок закрыл обе карточки.
          return (
            <button
              className="nur-btn"
              style={{
                position: "fixed",
                left: 20,
                bottom: 150,
                zIndex: 60,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #E8A33D, #C97F1E)",
                color: "#2C1B06",
                fontWeight: 700,
                fontSize: 13,
                border: "none",
                boxShadow: "0 8px 24px rgba(232,163,61,0.45)",
              }}
              onClick={() => setDismissedLobbyIds((prev) => { const next = new Set(prev); next.delete(myLobbyRaw.id); return next; })}
            >
              <LinkIcon size={15} /> Показать ссылку и пароль от сервера
            </button>
          );
        }
        const myLobby = myLobbyRaw;
        const myTeam = teams.find((t) => myTeamIds.includes(t.id) && (t.id === myLobby.team1_id || t.id === myLobby.team2_id));
        const oppTeamId = myTeam?.id === myLobby.team1_id ? myLobby.team2_id : myLobby.team1_id;
        const oppTeam = teamMap[oppTeamId];
        return (
          <div style={styles.readyCheckOverlay}>
            <div style={{ ...styles.readyCheckCard, position: "relative" }}>
              <button
                style={{ position: "absolute", top: 10, right: 10, ...styles.iconBtn }}
                title="Закрыть"
                onClick={() => setDismissedLobbyIds((prev) => new Set(prev).add(myLobby.id))}
              >
                <X size={13} color="#AE9B99" />
              </button>
              {profile?.is_admin && (
                <button
                  style={{ position: "absolute", top: 10, right: 40, ...styles.iconBtn }}
                  title="Удалить лобби (админ)"
                  onClick={async () => {
                    await supabase.from("match_lobbies").delete().eq("id", myLobby.id);
                    refreshMatchLobbies();
                  }}
                >
                  <Trash2 size={13} color="#AE9B99" />
                </button>
              )}
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 22, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>
                {myTeam ? teamLabel(myTeam) : "Вы"} <span style={{ color: "#D9414C" }}>VS</span> {oppTeam ? teamLabel(oppTeam) : "Соперник"}
              </div>
              <div style={{ ...styles.vetoTurnLabel, marginBottom: 24 }}>Карта: {MAP_LABEL[myLobby.map] || myLobby.map}</div>

              {(myLobby.status === "pending" || myLobby.status === "creating") && (
                <div style={{ ...styles.hint, textAlign: "center" }}>Готовим сервер, подождите немного…</div>
              )}

              {myLobby.status === "failed" && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#FF5A5A", fontSize: 12.5, marginBottom: 8 }}>Не удалось создать сервер. Напишите в поддержку.</div>
                  {profile?.is_admin && (
                    <button
                      className="nur-btn"
                      style={styles.ghostBtnSm}
                      onClick={async () => {
                        await supabase.from("match_lobbies").update({ status: "pending", error_message: null }).eq("id", myLobby.id);
                        refreshMatchLobbies();
                      }}
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              )}

              {(myLobby.status === "ready" || myLobby.status === "started") && (
                <div style={{ width: "100%", maxWidth: 420 }}>
                  <div style={{ ...styles.hint, textAlign: "center", marginBottom: 10 }}>
                    {myLobby.status === "started" ? "Матч начался — заходите!" : "Сервер готов — заходите по ссылке"}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <input readOnly value={myLobby.lobby_url || ""} className="nur-in" style={{ ...styles.input, flex: 1 }} onClick={(e) => e.target.select()} />
                    <button className="nur-btn" style={styles.ghostBtnSm} onClick={() => navigator.clipboard.writeText(myLobby.lobby_url || "")}>
                      Копировать
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input readOnly value={myLobby.lobby_password || ""} className="nur-in" style={{ ...styles.input, flex: 1 }} onClick={(e) => e.target.select()} />
                    <button className="nur-btn" style={styles.ghostBtnSm} onClick={() => navigator.clipboard.writeText(myLobby.lobby_password || "")}>
                      Копировать
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      padding: "10px 12px",
                      background: "#241708",
                      border: "1px solid #4A3410",
                      borderRadius: 8,
                      fontSize: 11.5,
                      color: "#E8A33D",
                      lineHeight: 1.5,
                      textAlign: "center",
                    }}
                  >
                    ⏱ Заходите как можно скорее: до 3 минут даётся на то, чтобы зашёл хотя бы один игрок, а после этого —
                    ещё 1 минута на сбор остальных. Если состав не соберётся полностью, матч всё равно стартует тем
                    составом, что есть.
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {toasts.length > 0 && (
        <div style={styles.toastStack}>
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{ ...styles.toast, cursor: t.sender ? "pointer" : "default" }}
              onClick={() => {
                if (t.sender) {
                  openChat(t.sender);
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }
              }}
            >
              <MessageCircle size={16} color="#E8A33D" />
              <span style={{ fontWeight: 600 }}>{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {session && !supportPanelOpen && (
        <button
          style={styles.supportFab}
          onClick={() => {
            if (profile?.is_admin || profile?.is_moderator) {
              setActiveTab("support");
              setViewingUser(null);
              refreshSupportTickets();
              refreshSupportArchive();
            } else {
              openSupportChat(null);
            }
          }}
        >
          <LifeBuoy size={20} color="#fff" />
          {supportUnread > 0 && <span style={styles.notifyDot} />}
        </button>
      )}

      {supportPanelOpen && (
        <div style={{ ...styles.supportPanel, transform: `translate(${supportDrag.x}px, ${supportDrag.y}px)` }}>
          <div style={{ ...styles.chatHeader, cursor: "grab", userSelect: "none" }} onMouseDown={onSupportHeaderMouseDown}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ color: "#F3ECEA", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Поддержка NUR</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {staffProfiles.filter((s) => onlineUserIds.has(s.id)).length === 0 && (
                    <span style={{ ...styles.hint, fontSize: 11 }}>Сейчас никого нет в сети</span>
                  )}
                  {staffProfiles
                    .filter((s) => onlineUserIds.has(s.id))
                    .slice(0, 6)
                    .map((s) => (
                      <div key={s.id} style={{ ...styles.avatarWrapSm, width: 22, height: 22 }} title={s.username}>
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" style={{ ...styles.avatarImgSm, width: 22, height: 22 }} />
                        ) : (
                          <div style={{ ...styles.avatarFallbackSm, width: 22, height: 22, fontSize: 10 }}>{(s.username || "?")[0].toUpperCase()}</div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            {supportTicketStatus === "open" && (
              confirmCloseTicket ? (
                <>
                  <span style={{ fontSize: 11, color: "#AE9B99", whiteSpace: "nowrap" }}>Закрыть тикет?</span>
                  <button
                    style={{ ...styles.iconBtn, borderColor: "#FF5A5A" }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={closeSupportTicket}
                    title="Подтвердить закрытие"
                  >
                    <Check size={13} color="#FF5A5A" />
                  </button>
                  <button style={styles.iconBtn} onMouseDown={(e) => e.stopPropagation()} onClick={() => setConfirmCloseTicket(false)} title="Отмена">
                    <X size={13} color="#AE9B99" />
                  </button>
                </>
              ) : (
                <button
                  style={styles.iconBtn}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setConfirmCloseTicket(true)}
                  title="Закрыть тикет"
                >
                  <ShieldAlert size={13} color="#AE9B99" />
                </button>
              )
            )}
            <button style={styles.iconBtn} onMouseDown={(e) => e.stopPropagation()} onClick={() => setSupportPanelOpen(false)}>
              <X size={14} color="#AE9B99" />
            </button>
          </div>

          <div ref={supportMessagesRef} className="nur-chat-scroll" style={styles.chatMessages}>
            {supportMessages.length === 0 && <div style={{ ...styles.hint, textAlign: "center", marginTop: 20 }}>Напишите нам, если есть вопрос</div>}
            {supportMessages.map((m) => {
              const mine = m.sender_id === session?.user.id;
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ ...styles.chatBubble, ...(mine ? styles.chatBubbleMine : styles.chatBubbleTheirs) }}>{m.content}</div>
                </div>
              );
            })}
          </div>

          {supportTicketStatus === "open" ? (
            <div style={styles.chatInputRow}>
              <input
                className="nur-in"
                placeholder="Сообщение…"
                value={supportInput}
                onChange={(e) => setSupportInput(e.target.value)}
                onKeyDown={(e) => {
                  playTypeSound(e);
                  if (e.key === "Enter") sendSupportMessage();
                }}
                style={{ ...styles.input, flex: 1 }}
              />
              <button className="nur-btn" style={styles.accentBtnSm} onClick={sendSupportMessage}>
                Отпр.
              </button>
            </div>
          ) : (
            <div style={{ ...styles.hint, textAlign: "center", padding: "12px 14px", borderTop: "1px solid #3D2226" }}>
              Тикет закрыт — напишите новое сообщение, чтобы начать новое обращение
            </div>
          )}
        </div>
      )}

      {((session && profile && !profile.agreed_rules_at) || showRulesModal) && (
        <div style={styles.readyCheckOverlay}>
          <div style={{ ...styles.readyCheckCard, maxWidth: 560, maxHeight: "82vh", overflowY: "auto", textAlign: "left", position: "relative" }}>
            {(!session || !profile || profile.agreed_rules_at) && (
              <button
                style={{ position: "absolute", top: 10, right: 10, ...styles.iconBtn }}
                title="Закрыть"
                onClick={() => setShowRulesModal(false)}
              >
                <X size={13} color="#AE9B99" />
              </button>
            )}
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>
              ПРАВИЛА САЙТА
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#D8CBC9", lineHeight: 1.5 }}>
              <li>В случае взноса организатору деньги не возвращаются после формирования сетки.</li>
              <li>Если не успели зайти на турнир, заплатив за взнос, деньги не возвращаются.</li>
              <li>Соглашаетесь вести запись экрана во время матча — в случае отказа предоставить запись засчитывается техническое поражение вашей команды.</li>
              <li>Если вы не из стран Россия, Казахстан и других дружественных стран — в случае выигрыша деньги не переводятся, выдаются только подписки на сервисы.</li>
              <li>В случае подозрения кого-то в читерстве — сообщайте в поддержку на сайте или пишите @quqububu, предоставив файл своей записи.</li>
              <li>Если вы или тиммейт не смогли присоединиться в лобби — играете тем составом, что есть.</li>
              <li>Правила могут изменяться и дополняться без публичной огласки.</li>
            </ol>
            <div style={{ ...styles.hint, marginTop: 16, fontSize: 11.5 }}>
              Необязательно: есть идеи, как дополнить сайт? Или нашли ошибку? Пишите @quqububu
            </div>
            {session && profile && !profile.agreed_rules_at ? (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={rulesChecked} onChange={(e) => setRulesChecked(e.target.checked)} style={{ width: 17, height: 17, cursor: "pointer" }} />
                  <span style={{ fontSize: 12.5, color: "#AE9B99" }}>Ставя галочку, вы соглашаетесь с правилами сайта</span>
                </label>
                <button
                  className="nur-btn"
                  style={{ ...styles.accentBtn, marginTop: 16, width: "100%", justifyContent: "center", opacity: rulesChecked ? 1 : 0.4, cursor: rulesChecked ? "pointer" : "default" }}
                  disabled={!rulesChecked}
                  onClick={async () => {
                    if (!rulesChecked) return;
                    const { error } = await supabase.from("profiles").update({ agreed_rules_at: new Date().toISOString() }).eq("id", session.user.id);
                    if (error) return setErrorMsg(error.message);
                    setProfile((prev) => ({ ...prev, agreed_rules_at: new Date().toISOString() }));
                  }}
                >
                  Войти на сайт
                </button>
              </>
            ) : (
              <button
                className="nur-btn"
                style={{ ...styles.ghostBtn, marginTop: 20, width: "100%", justifyContent: "center" }}
                onClick={() => setShowRulesModal(false)}
              >
                Понятно
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  // ---------- Новая главная: сетка шапки и обратный отсчёт ----------
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(260px, 0.85fr)",
    gap: 1,
    alignItems: "stretch",
    background: "#3D2226",
    border: "1px solid #3D2226",
    borderRadius: 14,
    overflow: "hidden",
  },
  unskew: { display: "inline-block", transform: "skewX(9deg)" },
  heroBtnPrimary: {
    background: "#D9414C",
    color: "#FFFFFF",
    border: "none",
    padding: "12px 22px",
    fontFamily: "'Anton', sans-serif",
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
    transform: "skewX(-9deg)",
    textDecoration: "none",
  },
  heroBtnGhost: {
    background: "transparent",
    color: "#F3ECEA",
    border: "1px solid #5A3A3E",
    padding: "12px 22px",
    fontFamily: "'Anton', sans-serif",
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
    transform: "skewX(-9deg)",
    textDecoration: "none",
  },
  vsRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 18 },
  vsPanel: { flex: 1, minWidth: 0, background: "#1F1417", padding: "10px 12px", transform: "skewX(-9deg)" },
  vsTeam: {
    display: "block",
    fontFamily: "'Anton', sans-serif",
    fontSize: 13,
    letterSpacing: 0.3,
    color: "#F3ECEA",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transform: "skewX(9deg)",
  },
  vsLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8C7876", flexShrink: 0 },
  heroGhost: {
    position: "absolute",
    right: -18,
    top: -34,
    fontFamily: "'Anton', sans-serif",
    fontSize: 150,
    lineHeight: 1,
    color: "rgba(217,65,76,0.07)",
    pointerEvents: "none",
    userSelect: "none",
  },
  heroSide: {
    borderRadius: 0,
    border: "none",
    background: "linear-gradient(165deg,#160F11,#0C0809)",
    padding: "26px 24px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  heroSideLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#8C7876",
  },
  cdRow: { display: "flex", alignItems: "flex-end", gap: 4, marginTop: 12, flexWrap: "wrap" },
  cdNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1,
    color: "#E8A33D",
    fontVariantNumeric: "tabular-nums",
  },
  cdUnit: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8C7876", marginBottom: 3, marginRight: 6 },
  cdTourName: { fontFamily: "'Anton', sans-serif", fontSize: 20, letterSpacing: 0.3, color: "#F3ECEA", marginTop: 16, lineHeight: 1.1 },
  cdTourMeta: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#8C7876", marginTop: 6, letterSpacing: 0.5 },

  regProgressRow: { display: "flex", alignItems: "baseline", gap: 8, marginTop: 18 },
  regProgressNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 30,
    fontWeight: 700,
    color: "#E8A33D",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  regProgressWord: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8C7876", letterSpacing: 0.8 },
  regTrack: { height: 6, background: "#26191B", borderRadius: 3, overflow: "hidden", marginTop: 10 },
  regFill: { height: "100%", background: "linear-gradient(90deg,#D9414C,#E8A33D)", borderRadius: 3, transition: "width 0.4s ease" },

  // ---------- Бегущая строка результатов ----------
  tickerWrap: {
    marginTop: 14,
    borderRadius: 0,
    overflow: "hidden",
    background: "#D9414C",
    padding: "8px 0",
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
  },
  tickerTrack: { display: "flex", width: "200%" },
  tickerGroup: { display: "flex", gap: 26, paddingRight: 26, flexShrink: 0, whiteSpace: "nowrap" },
  tickerItem: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    color: "#2C090C",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // ---------- Компактный переключатель режима в заголовке секции ----------
  pillGroup: { display: "flex", gap: 5, flexShrink: 0 },
  pillBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.8,
    padding: "6px 13px",
    background: "#1A1315",
    color: "#8C7876",
    border: "1px solid #2E1B1E",
    cursor: "pointer",
    transform: "skewX(-9deg)",
    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
  },
  pillBtnActive: { background: "#E8A33D", color: "#2C1B06", borderColor: "#E8A33D" },

  // ---------- Нумерованные заголовки секций ----------
  secHead: { display: "flex", alignItems: "center", gap: 11, marginBottom: 14 },
  secNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    color: "#2C090C",
    background: "#D9414C",
    padding: "3px 8px",
    transform: "skewX(-9deg)",
    display: "inline-block",
  },
  secTitle: { fontFamily: "'Anton', sans-serif", fontSize: 16, letterSpacing: 0.8, textTransform: "uppercase", color: "#F3ECEA" },
  secRail: { flex: 1, height: 3, background: "#2A1A1C", minWidth: 20 },

  // ---------- Карточки матчей ----------
  liveGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 },
  homeMatchCard: { border: "1px solid #2A1A1C", borderRadius: 12, background: "#120E0F", padding: 14 },
  matchCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  liveTag: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, color: "#FF6B6B", letterSpacing: 1 },
  doneTag: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#7A6668", letterSpacing: 1 },
  matchMap: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9.5,
    color: "#7A6668",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 140,
  },
  matchRow: { display: "flex", alignItems: "center", gap: 8 },
  matchSideL: { flex: 1, minWidth: 0, background: "#1F1417", padding: "10px 12px", borderRadius: 0, transform: "skewX(-9deg)" },
  matchSideR: { flex: 1, minWidth: 0, background: "#1F1417", padding: "10px 12px", borderRadius: 0, transform: "skewX(-9deg)" },
  matchTeam: {
    display: "block",
    fontFamily: "'Anton', sans-serif",
    fontSize: 13,
    letterSpacing: 0.3,
    color: "#F3ECEA",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  matchVs: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7A6668", flexShrink: 0 },
  matchScore: { fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  matchFoot: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#5A4548", marginTop: 10, letterSpacing: 0.5, textTransform: "uppercase" },

  // ---------- Страница «Матчи» ----------
  matchFilterRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 },
  soonTag: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#8C7876", letterSpacing: 1 },
  matchGroupHead: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
    borderLeft: "3px solid #D9414C",
    paddingLeft: 10,
    marginBottom: 10,
  },
  matchGroupName: { fontFamily: "'Anton', sans-serif", fontSize: 16, letterSpacing: 0.4, color: "#F3ECEA", textTransform: "uppercase" },
  matchGroupMeta: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7A6668", letterSpacing: 0.5 },
  matchListRow: { border: "1px solid #2A1A1C", background: "#120E0F", padding: "12px 14px", marginBottom: 8 },
  matchListTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 },
  matchListBody: { display: "flex", alignItems: "center", gap: 12 },
  matchListSide: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9 },
  matchListLogo: {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: "50%",
    overflow: "hidden",
    background: "#1C1315",
    border: "1px solid #3D2226",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  matchListName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "'Anton', sans-serif",
    fontSize: 14,
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  matchListScore: {
    flexShrink: 0,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 19,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    minWidth: 66,
    textAlign: "center",
  },

  // ---------- Лестница ----------
  ladderHead: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px 8px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#5A4548",
  },
  ladderRow: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "#120E0F",
    borderLeft: "3px solid #3D2226",
    borderRadius: "0 8px 8px 0",
    marginBottom: 6,
    overflow: "hidden",
  },
  ladderRowTop: { background: "#181110", borderLeftColor: "#E8A33D" },
  ladderGhostNum: {
    position: "absolute",
    right: 10,
    top: -16,
    fontFamily: "'Anton', sans-serif",
    fontSize: 58,
    lineHeight: 1,
    color: "rgba(255,255,255,0.028)",
    pointerEvents: "none",
    userSelect: "none",
  },
  ladderPos: {
    width: 26,
    height: 26,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#26191B",
    color: "#C9B8B6",
    fontFamily: "'Anton', sans-serif",
    fontSize: 13,
    borderRadius: 4,
    position: "relative",
  },
  ladderPosTop: { background: "#E8A33D", color: "#2C1B06" },
  ladderLogo: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: "50%",
    overflow: "hidden",
    background: "#1C1315",
    border: "1px solid #3D2226",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ladderName: {
    fontFamily: "'Anton', sans-serif",
    fontSize: 16,
    letterSpacing: 0.3,
    color: "#F3ECEA",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ladderSub: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#7A6668", letterSpacing: 0.5, marginTop: 2 },
  winBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    background: "#1B2A16",
    color: "#8BC34A",
    padding: "3px 7px",
    borderRadius: 3,
  },
  lossBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    background: "#2A1618",
    color: "#E06C6C",
    padding: "3px 7px",
    borderRadius: 3,
  },
  wrTrack: { flex: 1, height: 6, background: "#26191B", borderRadius: 3, overflow: "hidden" },
  wrFill: { height: "100%", borderRadius: 3, transition: "width 0.4s ease" },
  wrPct: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, width: 36, flexShrink: 0 },
  ladderPts: {
    width: 46,
    flexShrink: 0,
    textAlign: "right",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 18,
    fontWeight: 700,
    position: "relative",
    fontVariantNumeric: "tabular-nums",
  },

  // ---------- Полоса статистики и мини-сетка в карточке турнира ----------
  tourStatStrip: { display: "flex", flexWrap: "wrap", borderTop: "1px solid #2A1A1C", borderBottom: "1px solid #2A1A1C", marginTop: 14 },
  tourStatCell: { flex: "1 1 90px", padding: "9px 12px", borderRight: "1px solid #2A1A1C" },
  tourStatLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#7A6668", letterSpacing: 0.8 },
  tourStatVal: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#F3ECEA", marginTop: 2 },
  miniBracketWrap: { display: "flex", gap: 12, marginTop: 14, overflowX: "auto", paddingBottom: 6, alignItems: "stretch" },
  miniCol: { minWidth: 128, flex: "1 0 128px", display: "flex", flexDirection: "column" },
  miniColLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#5A4548", letterSpacing: 1, marginBottom: 8 },
  miniMatch: { background: "#140F11", borderLeft: "2px solid #2E1B1E", padding: "6px 8px", borderRadius: "0 4px 4px 0", minHeight: 40 },
  miniSlot: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 },
  miniTeam: {
    fontFamily: "'Anton', sans-serif",
    fontSize: 11,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  miniScore: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  // overflowX: скрываем — полноширинная бегущая строка использует 100vw,
  // а 100vw включает ширину вертикального скроллбара и иначе даёт
  // паразитную горизонтальную прокрутку. Sticky-элементов в проекте нет,
  // так что скрытие overflow ничего не ломает.
  page: { minHeight: "100vh", background: "#0E0B0C", color: "#F3ECEA", fontFamily: "'Inter', sans-serif", overflowX: "hidden" },
  loadingWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#0E0B0C" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: "14px 22px", borderBottom: "1px solid #2E1B1E", background: "#150F10", userSelect: "none" },
  logoImg: { width: 38, height: 38, borderRadius: 7, objectFit: "cover", boxShadow: "0 0 0 1px #3D2226, 0 0 14px #D9414C55" },
  logo: {
    fontFamily: "'Anton', 'Teko', sans-serif",
    fontWeight: 400,
    fontSize: 22,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#F3ECEA",
    textShadow: "0 0 18px #D9414C66",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 0,
    border: "none",
    background:
      "radial-gradient(1000px 380px at 12% 0%, rgba(217,65,76,0.28), transparent 60%), radial-gradient(800px 320px at 88% 100%, rgba(232,163,61,0.18), transparent 60%), linear-gradient(160deg,#1A1013,#0E0809)",
    padding: "46px 44px",
  },
  heroStreak: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.5,
    background: "repeating-linear-gradient(105deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 26px)",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#2C090C",
    border: "none",
    padding: "6px 14px",
    borderRadius: 0,
    background: "#D9414C",
    transform: "skewX(-9deg)",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontFamily: "'Anton', sans-serif",
    fontSize: 52,
    lineHeight: 0.94,
    letterSpacing: 0.5,
    margin: "18px 0 12px",
    textTransform: "uppercase",
    position: "relative",
    zIndex: 1,
  },
  heroTitleAccent: { color: "#D9414C" },
  heroText: { color: "#AE9B99", fontSize: 15, maxWidth: 520, lineHeight: 1.65, position: "relative", zIndex: 1 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 },
  statCard: {
    border: "1px solid #2A1A1C",
    borderRadius: 12,
    padding: "16px 18px",
    background: "linear-gradient(180deg,#150D0F,#100A0C)",
  },
  statNum: { fontFamily: "'Anton', sans-serif", fontSize: 26, color: "#fff" },
  statLabel: { fontSize: 11.5, color: "#8C7876", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 3 },
  lbRow: { display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid #1E1416" },
  lbPos: {
    width: 22,
    height: 22,
    borderRadius: 6,
    display: "grid",
    placeItems: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 11,
    background: "#1E1416",
    color: "#8C7876",
    flexShrink: 0,
  },
  lbName: { flex: 1, fontSize: 13, fontWeight: 600, color: "#F3ECEA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  lbPts: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#E8A33D", fontWeight: 700 },
  emptyStateBox: {
    border: "1px dashed #3D2226",
    borderRadius: 14,
    padding: 34,
    textAlign: "center",
    background: "linear-gradient(180deg,#130C0E,#0E0809)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  emptyStateTitle: { fontSize: 15, fontWeight: 600, color: "#F3ECEA", marginTop: 10, marginBottom: 6 },
  emptyStateText: { color: "#8C7876", fontSize: 13 },
  promoBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 15px",
    border: "1px solid #2A1A1C",
    borderLeft: "3px solid #D9414C",
    borderRadius: 12,
    background: "linear-gradient(90deg, rgba(217,65,76,0.08), transparent)",
    textDecoration: "none",
    cursor: "pointer",
  },
  promoImg: { width: 44, height: 44, objectFit: "cover", flexShrink: 0, borderRadius: 9 },
  promoText: { display: "flex", flexDirection: "column", gap: 4 },
  promoTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13.5,
    fontWeight: 600,
    color: "#F3ECEA",
  },
  promoSub: { fontSize: 12, color: "#AE9B99" },
  tabsRow: { display: "flex", gap: 4, background: "#1C1416", padding: 4, border: "1px solid #2E1B1E" },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#8C7876",
    fontFamily: "'Anton', sans-serif",
    fontSize: 13.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    padding: "6px 2px",
    marginRight: 4,
    cursor: "pointer",
    transition: "color 0.15s ease, border-color 0.15s ease",
  },
  tabBtnActive: { color: "#F3ECEA", borderBottomColor: "#D9414C" },
  modeToggle: { display: "flex", gap: 4, background: "#1C1416", padding: 4, border: "1px solid #2E1B1E" },
  modeBtn: { border: "1px solid #3D2226", borderRadius: 10, color: "#AE9B99", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, padding: "11px 14px", cursor: "pointer", position: "relative", zIndex: 2 },
  modeBtnActive: { color: "#1C1416", fontWeight: 700, borderColor: "transparent", boxShadow: "0 0 18px rgba(232,163,61,0.5), inset 0 1px 0 rgba(255,255,255,0.35)" },
  body: { maxWidth: 1240, margin: "0 auto", padding: "26px 20px 60px" },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  sectionHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, letterSpacing: 1.5, color: "#E8DCDB" },
  card: { border: "1px solid #3D2226", background: "#1C1416", padding: 18 },
  cardHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  tourThumb: {
    width: 150,
    height: 88,
    flexShrink: 0,
    borderRadius: 10,
    background: "linear-gradient(140deg,#7d1f27,#2a1013)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    padding: 8,
  },
  tourThumbText: {
    fontFamily: "'Anton', sans-serif",
    fontSize: 15,
    opacity: 0.75,
    letterSpacing: 1,
    color: "#fff",
    textAlign: "center",
    lineHeight: 1.15,
  },
  tourGoBtn: {
    padding: "10px 18px",
    borderRadius: 9,
    border: "none",
    fontSize: 12.5,
    fontWeight: 700,
    background: "linear-gradient(180deg,#E8564F,#B32B34)",
    color: "#fff",
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
    alignSelf: "center",
  },
  cardTitle: { fontSize: 15.5, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: "#AE9B99", marginTop: 3 },
  badge: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: 0.5, border: "1px solid #4A2C2F", padding: "3px 8px", color: "#E8DCDB", whiteSpace: "nowrap" },
  championBanner: { marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "8px 12px", border: "1px solid #D9414C55", background: "#D9414C14" },
  tourBanner: { width: "100%", height: 140, objectFit: "cover", display: "block" },
  tourBannerSm: { width: 56, height: 56, objectFit: "cover", flexShrink: 0 },
  prizeRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: "#F3ECEA" },
  scheduleRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    fontSize: 11.5,
    color: "#AE9B99",
    fontFamily: "'JetBrains Mono', monospace",
  },
  regRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
  hint: { fontSize: 12, color: "#8C7876" },
  // Существовал в разметке, но не был описан в styles — текст рендерился без стиля.
  emptyState: {
    border: "1px dashed #3D2226",
    borderRadius: 12,
    padding: "18px 20px",
    fontSize: 13,
    color: "#8C7876",
    background: "#120E0F",
  },
  input: { background: "#0E0B0C", border: "1px solid #4A2C2F", color: "#F3ECEA", padding: "9px 10px", fontSize: 13.5, fontFamily: "'Inter', sans-serif", outline: "none" },
  select: { background: "#0E0B0C", border: "1px solid #4A2C2F", color: "#F3ECEA", padding: "9px 10px", fontSize: 13, outline: "none" },
  accentBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#D9414C", color: "#FFFFFF", border: "none", padding: "10px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  accentBtnSm: { display: "flex", alignItems: "center", gap: 6, background: "#D9414C", color: "#FFFFFF", border: "none", padding: "8px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  tourCardTitle: { fontSize: 17, fontWeight: 700, color: "#F3ECEA", marginBottom: 8 },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  tchip: {
    fontSize: 11,
    padding: "4px 9px",
    borderRadius: 6,
    border: "1px solid #3D2226",
    color: "#AE9B99",
    fontWeight: 600,
    letterSpacing: 0.4,
    whiteSpace: "nowrap",
  },
  tchipLive: { borderColor: "#D9414C", color: "#ff7b7b", background: "rgba(217,65,76,0.1)" },
  tchipGold: { borderColor: "rgba(232,163,61,0.5)", color: "#E8A33D" },
  ghostBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    color: "#F3ECEA",
    border: "1px solid #4A2C2F",
    borderRadius: 10,
    padding: "13px 26px",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostBtnSm: { display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "#AE9B99", border: "1px solid #4A2C2F", padding: "8px 12px", fontSize: 12.5, cursor: "pointer" },
  iconBtn: { background: "transparent", border: "1px solid #4A2C2F", padding: 6, cursor: "pointer", color: "#AE9B99" },
  segBtn: { flex: 1, background: "#0E0B0C", border: "1px solid #4A2C2F", color: "#AE9B99", padding: "8px 0", fontSize: 12.5, cursor: "pointer" },
  segBtnActive: { background: "#D9414C", color: "#FFFFFF", borderColor: "#D9414C", fontWeight: 600 },
  memberChip: { fontSize: 12, background: "#0E0B0C", border: "1px solid #2E1B1E", padding: "4px 9px", color: "#E8DCDB" },
  suggestBox: {
    position: "absolute",
    top: "calc(100% + 2px)",
    left: 0,
    right: 0,
    zIndex: 5,
    background: "#1C1416",
    border: "1px solid #4A2C2F",
    maxHeight: 160,
    overflowY: "auto",
  },
  suggestItem: { padding: "8px 10px", fontSize: 13, color: "#F3ECEA", cursor: "pointer" },
  avatarWrap: { width: 56, height: 56, flexShrink: 0 },
  avatarImg: { width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "1px solid #3D2226", userSelect: "none", pointerEvents: "none" },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#3D2226",
    color: "#D9414C",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 22,
  },
  avatarPill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#1C1416",
    border: "1px solid #3D2226",
    borderRadius: 20,
    padding: "6px 14px 6px 12px",
    cursor: "pointer",
    userSelect: "none",
  },
  rulesBtn: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    userSelect: "none",
    opacity: 0.7,
  },
  bellBtn: {
    position: "relative",
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#1C1416",
    border: "1px solid #3D2226",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    userSelect: "none",
  },
  avatarWrapPill: { width: 26, height: 26, flexShrink: 0 },
  avatarImgPill: { width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "1px solid #D9414C" },
  avatarFallbackPill: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "#3D2226",
    border: "1px solid #D9414C",
    color: "#D9414C",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 12,
  },
  profileActionBtn: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    padding: "9px 15px",
    cursor: "pointer",
    border: "1px solid #3D2226",
    background: "transparent",
    color: "#AE9B99",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  profileActionBtnPrimary: { background: "#D9414C", borderColor: "#D9414C", color: "#fff", fontWeight: 600 },
  profilePanel: { background: "#150F10", border: "1px solid #3D2226" },
  profilePanelHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #2A1B1D",
  },
  profilePanelTitle: {
    fontFamily: "'Anton', sans-serif",
    fontSize: 12.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    borderLeft: "2px solid #D9414C",
    paddingLeft: 9,
    color: "#F3ECEA",
  },
  profilePanelCount: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#7A6668" },
  teamLogoShape: {
    width: 34,
    height: 34,
    flexShrink: 0,
    clipPath: "polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)",
    background: "linear-gradient(140deg, #2E1B1E, #1C1315)",
  },
  hexAvatarSm: {
    width: 30,
    height: 30,
    flexShrink: 0,
    clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
    background: "#2E1B1E",
    color: "#D9414C",
    fontWeight: 700,
    fontSize: 11.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  notifyDot: { position: "absolute", top: -2, right: -3, width: 7, height: 7, borderRadius: "50%", background: "#D9414C" },
  navPanelBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(6,4,5,0.55)",
    zIndex: 90,
  },
  navPanel: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: "min(360px, 92vw)",
    background: "#150F10",
    borderLeft: "1px solid #3D2226",
    boxShadow: "-20px 0 50px rgba(0,0,0,0.5)",
    zIndex: 91,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  navDropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 300,
    background: "rgba(28,20,22,0.92)",
    border: "1px solid #3D2226",
    borderRadius: 10,
    padding: 10,
    zIndex: 20,
    overflow: "hidden",
  },
  avatarWrapMenu: { width: 44, height: 44, flexShrink: 0 },
  avatarImgMenu: { width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #D9414C" },
  avatarFallbackMenu: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#3D2226",
    color: "#D9414C",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 17,
  },
  navDropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    background: "transparent",
    border: "none",
    color: "#F3ECEA",
    fontSize: 13,
    padding: "9px 10px",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'Inter', sans-serif",
  },
  friendRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: "#0E0B0C", border: "1px solid #2E1B1E", userSelect: "none" },
  avatarWrapSm: { width: 32, height: 32, flexShrink: 0 },
  avatarImgSm: { width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #3D2226", userSelect: "none", pointerEvents: "none" },
  avatarFallbackSm: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#3D2226",
    color: "#D9414C",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 14,
  },
  errorNote: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#FF5A5A", marginBottom: 14, padding: "8px 12px", border: "1px solid #FF5A5A33" },
  leaderRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#0E0B0C", border: "1px solid #2E1B1E" },
  leaderRank: { width: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, display: "flex", alignItems: "center" },
  leaderName: { flex: 1, fontSize: 13 },
  leaderStat: { fontSize: 11.5, color: "#AE9B99", fontFamily: "'JetBrains Mono', monospace" },
  matchCard: { width: "100%", height: "100%", background: "transparent", borderRadius: 4, overflow: "hidden" },
  chatPanel: {
    position: "fixed",
    bottom: 20,
    right: 20,
    width: 300,
    height: 400,
    minWidth: 260,
    minHeight: 280,
    maxWidth: "80vw",
    maxHeight: "85vh",
    resize: "both",
    overflow: "hidden",
    background: "#1C1416",
    border: "1px solid #3D2226",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    zIndex: 50,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderBottom: "1px solid #3D2226",
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  chatBubble: { maxWidth: "75%", padding: "7px 10px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.4, wordBreak: "break-word" },
  chatBubbleMine: { background: "#D9414C", color: "#fff" },
  chatBubbleTheirs: { background: "#0E0B0C", color: "#F3ECEA", border: "1px solid #2E1B1E" },
  chatInputRow: { display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid #3D2226" },
  supportPageGrid: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    border: "1px solid #3D2226",
    background: "#1C1416",
    minHeight: 520,
  },
  supportPageSidebar: { borderRight: "1px solid #3D2226", display: "flex", flexDirection: "column" },
  supportPageTabs: { display: "flex", borderBottom: "1px solid #3D2226" },
  supportPageTabBtn: {
    flex: 1,
    textAlign: "center",
    padding: "12px 0",
    fontSize: 12,
    letterSpacing: 0.5,
    color: "#AE9B99",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: "'JetBrains Mono', monospace",
  },
  supportPageTabBtnActive: { color: "#E8A33D", borderBottomColor: "#E8A33D", fontWeight: 700 },
  supportPageList: { overflowY: "auto", flex: 1 },
  supportPageRow: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #241618", cursor: "pointer" },
  supportPageRowActive: { background: "rgba(217,65,76,0.12)" },
  supportPageConv: { display: "flex", flexDirection: "column", minHeight: 520 },
  supportPageConvHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #3D2226" },
  supportPageMessages: { flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" },
  supportFab: {
    position: "fixed",
    bottom: 20,
    left: 20,
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#D9414C",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
    zIndex: 50,
  },
  readyCheckOverlay: {
    position: "fixed",
    inset: 0,
    background: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
    padding: 20,
    overflow: "hidden",
  },
  readyCheckCard: {
    width: "100%",
    maxWidth: 380,
    background: "#1C1416",
    border: "1px solid #D9414C",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(217,65,76,0.25)",
    padding: "28px 26px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  readyCheckTimer: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 40,
    fontWeight: 700,
    color: "#E8A33D",
    letterSpacing: 2,
  },
  vetoTurnLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "#E8A33D",
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  },
  vetoCard: {
    position: "relative",
    flex: "1 1 0",
    minWidth: 0,
    maxWidth: 150,
    height: 420,
    overflow: "hidden",
    border: "1px solid #3D2226",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  vetoTeamBadge: {
    position: "absolute",
    top: "46%",
    left: "50%",
    transform: "translate(-50%,-50%) skewX(7deg)",
    width: 74,
    height: 74,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 20,
    letterSpacing: 0.5,
    color: "#F3ECEA",
    background: "rgba(14,8,9,0.9)",
    border: "2px solid",
  },
  toastStack: {
    position: "fixed",
    top: 80,
    right: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 80,
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#1C1416",
    border: "1px solid #D9414C",
    borderLeft: "4px solid #D9414C",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    color: "#F3ECEA",
    boxShadow: "0 10px 30px rgba(0,0,0,0.55), 0 0 16px rgba(217,65,76,0.35)",
    maxWidth: 280,
    animation: "nur-toast-in 0.25s ease",
  },
  supportPanel: {
    position: "fixed",
    bottom: 20,
    left: 20,
    width: 300,
    height: 400,
    minWidth: 260,
    minHeight: 280,
    maxWidth: "80vw",
    maxHeight: "85vh",
    resize: "both",
    overflow: "hidden",
    background: "#170D0E",
    border: "1px solid #3D2226",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    zIndex: 50,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  adSlotFilled: { display: "block", minHeight: 160, border: "1px solid #3D2226", borderRadius: 8, overflow: "hidden", background: "#150F10" },
  adSlotImg: { width: "100%", minHeight: 160, maxHeight: 220, objectFit: "cover", display: "block" },
  adSlotEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    padding: 16,
    border: "1px dashed #3D2226",
    borderRadius: 8,
    textDecoration: "none",
  },
  profileBannerBase: {
    position: "relative",
    zIndex: 0,
    width: "100%",
    height: 190,
    background: "linear-gradient(135deg, #2A1216, #150A0B)",
    overflow: "hidden",
  },
  profileBannerImg: { width: "100%", height: "100%", objectFit: "cover", display: "block", userSelect: "none", pointerEvents: "none" },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(5,3,3,0.75)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: 20,
  },
  modalPanel: {
    position: "relative",
    overflow: "hidden",
    maxWidth: "min(960px, 92vw)",
    maxHeight: "88vh",
    width: "100%",
    background: "linear-gradient(180deg, #0B0708 0%, #140B0C 100%)",
    border: "1px solid #3D2226",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    position: "relative",
    padding: "22px 24px 18px",
    borderBottom: "1px solid #3D2226",
  },
  modalBody: {
    padding: "10px 20px 24px",
    overflow: "auto",
  },
};
