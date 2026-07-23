import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import logoImg from "./logo.jpg";
import promoImg from "./promo.jpg";
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
  ChevronDown,
  MessageCircle,
} from "lucide-react";

const CARD_W = 200;
const CARD_H = 60;
const SLOT0 = 86;
const ROUND_GAP = 92;

const MODE_LABEL = { "5x5": "5 НА 5", "2x2": "2 НА 2" };
const STATUS_LABEL = { registration: "Регистрация", live: "Идёт турнир", finished: "Завершён" };
const STATUS_COLOR = { registration: "#6B7280", live: "#D9414C", finished: "#5C5254" };

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

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState("tournaments");
  const [activeMode, setActiveMode] = useState("5x5");

  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [ads, setAds] = useState([]);
  const [adUploading, setAdUploading] = useState({});
  const [adLinkDrafts, setAdLinkDrafts] = useState({});

  const [authScreen, setAuthScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamTag, setTeamTag] = useState("");
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState(null);
  const [addMemberQuery, setAddMemberQuery] = useState({});
  const [addMemberResults, setAddMemberResults] = useState({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [teamInvites, setTeamInvites] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentPendingIds, setSentPendingIds] = useState([]);
  const [sentPendingRequests, setSentPendingRequests] = useState([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
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
  const [viewingUserTab, setViewingUserTab] = useState("teams");
  const [viewingUserFriends, setViewingUserFriends] = useState([]);
  const [viewingUserFriendsLoading, setViewingUserFriendsLoading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const activeChatFriendRef = useRef(null);
  useEffect(() => {
    activeChatFriendRef.current = activeChatFriend;
  }, [activeChatFriend]);

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

  const [newTourName, setNewTourName] = useState("");
  const [newTourMode, setNewTourMode] = useState("5x5");
  const [newTourPrize, setNewTourPrize] = useState("");
  const [newTourMaxTeams, setNewTourMaxTeams] = useState("");
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

  useEffect(() => {
    setExpandedTour(null);
    setExpandedRounds(null);
  }, [activeTab]);

  const refreshTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, mode, name, tag, owner_id, max_size, team_members(member_name)")
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
      .select("tournament_id, round, winner_id, team1_id, team2_id")
      .not("winner_id", "is", null);
    if (error) return setErrorMsg(error.message);
    setAllMatches(data || []);
  }, []);

  const refreshAds = useCallback(async () => {
    const { data, error } = await supabase.from("ads").select("id, slot, image_url, link_url, is_active").order("slot");
    if (error) return;
    setAds(data || []);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("nur-ads-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, () => refreshAds())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAds]);

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
        "id, status, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, username, avatar_url, banner_url), receiver:profiles!friend_requests_receiver_id_fkey(id, username, avatar_url, banner_url)"
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
        () => refreshFriends(session.user.id)
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
          if (activeChatFriendRef.current && activeChatFriendRef.current.id === msg.sender_id) {
            setChatMessages((prev) => [...prev, msg]);
          } else {
            setUnreadCounts((prev) => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, refreshFriends, refreshTeamInvites]);

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
    setChatInput("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: session.user.id, receiver_id: activeChatFriend.id, content: text })
      .select()
      .single();
    if (error) return setErrorMsg(error.message);
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
    refreshAds();
    return () => sub.subscription.unsubscribe();
  }, [refreshTeams, refreshTournaments, refreshAllMatches, refreshAds]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setFriends([]);
      return;
    }
    supabase
      .from("profiles")
      .select("username, is_admin, avatar_url, banner_url")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) return setErrorMsg(error.message);
        setProfile(data);
      });
    refreshFriends(session.user.id);
    refreshTeamInvites(session.user.id);
  }, [session, refreshFriends, refreshTeamInvites]);

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
    const path = `${session.user.id}/banner.${ext}`;
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
        "sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, username, avatar_url, banner_url), receiver:profiles!friend_requests_receiver_id_fkey(id, username, avatar_url, banner_url)"
      )
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (error) return [];
    return (data || []).map((r) => (r.sender_id === userId ? r.receiver : r.sender));
  };

  const openUserProfile = (user) => {
    if (!user) return;
    setViewingUserTab("teams");
    setViewingUser(user);
    setViewingUserFriendsLoading(true);
    fetchUserFriends(user.id).then((list) => {
      setViewingUserFriends(list);
      setViewingUserFriendsLoading(false);
    });
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

  useEffect(() => {
    setShowCreateTeam(false);
  }, [activeMode]);

  const openCreateTeam = () => {
    setTeamName("");
    setTeamTag("");
    setShowCreateTeam(true);
  };

  const createTeam = async () => {
    if (!session || !teamName.trim()) return;
    if (!profile?.is_admin && myTeams(activeMode).length >= 1) {
      return setErrorMsg(`У вас уже есть команда в режиме ${MODE_LABEL[activeMode]} — обычным пользователям доступна только одна команда на режим.`);
    }
    if (containsBlockedLink(teamName) || containsBlockedLink(teamTag)) {
      return setErrorMsg("Название или тег команды не может содержать ссылки/упоминания каналов.");
    }
    if (containsProfanity(teamName) || containsProfanity(teamTag)) {
      return setErrorMsg("Название или тег команды содержит недопустимые слова.");
    }
    const max = maxForMode(activeMode);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        mode: activeMode,
        name: teamName.trim(),
        tag: teamTag.trim().toUpperCase().slice(0, 5),
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
      max_teams: newTourMaxTeams ? parseInt(newTourMaxTeams, 10) : null,
      banner_url,
      announce_at: newTourAnnounceAt || null,
      reg_open_at: newTourRegOpenAt || null,
      start_at: newTourStartAt || null,
    });
    setTourCreating(false);
    if (error) return setErrorMsg(error.message);
    setNewTourName("");
    setNewTourPrize("");
    setNewTourMaxTeams("");
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
      const path = `slot-${ad.slot}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("sponsors").upload(path, file);
      if (upErr) {
        setAdUploading((prev) => ({ ...prev, [ad.slot]: false }));
        return setErrorMsg("Не удалось загрузить картинку: " + upErr.message);
      }
      const { data: pub } = supabase.storage.from("sponsors").getPublicUrl(path);
      image_url = pub.publicUrl;
    }
    const link_url = adLinkDrafts[ad.slot] !== undefined ? adLinkDrafts[ad.slot] : ad.link_url || "";
    const { error } = await supabase
      .from("ads")
      .update({ image_url, link_url, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", ad.id);
    setAdUploading((prev) => ({ ...prev, [ad.slot]: false }));
    if (error) return setErrorMsg(error.message);
    refreshAds();
  };

  const toggleAdActive = async (ad) => {
    const { error } = await supabase.from("ads").update({ is_active: !ad.is_active }).eq("id", ad.id);
    if (error) return setErrorMsg(error.message);
    refreshAds();
  };

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

    const updates = {};
    const markUpdate = (id, field, value) => {
      updates[id] = { ...(updates[id] || {}), [field]: value };
    };

    let becameFinished = false;
    for (let r = 0; r < totalRounds; r++) {
      rounds[r].forEach((m, i) => {
        if (!m || m.winner_id) return;
        const hasOne = (m.team1_id && !m.team2_id) || (!m.team1_id && m.team2_id);
        if (!hasOne) return;
        const winner = m.team1_id || m.team2_id;
        m.winner_id = winner;
        markUpdate(m.id, "winner_id", winner);
        if (r + 1 < totalRounds) {
          const next = rounds[r + 1][Math.floor(i / 2)];
          if (next) {
            const field = i % 2 === 0 ? "team1_id" : "team2_id";
            next[field] = winner;
            markUpdate(next.id, field, winner);
          }
        } else {
          becameFinished = true;
        }
      });
    }

    const ids = Object.keys(updates);
    if (!ids.length) return;
    for (const id of ids) {
      await supabase.from("matches").update(updates[id]).eq("id", id);
    }
    if (becameFinished) {
      await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournamentId);
      refreshTournaments();
    }
    refreshAllMatches();
  };

  const loadBracket = async (tournamentId) => {
    await autoResolveByes(tournamentId);
    const { data, error } = await supabase
      .from("matches")
      .select("id, round, match_index, team1_id, team2_id, winner_id")
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
    await supabase.from("tournaments").update({ status: "live" }).eq("id", tournamentId);
    refreshTournaments();
    refreshAllMatches();
    setExpandedTour(tournamentId);
    loadBracket(tournamentId);
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
      .slice(0, 5);
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

  const tourList = tournaments.filter((t) => t.mode === activeMode);
  const leaderboard = computeLeaderboard(activeMode);

  const renderBracket = (tournamentId, rounds, interactive) => {
    if (!rounds || rounds.length === 0) return null;
    const g = computeGeometry(rounds);
    const totalRounds = rounds.length;
    return (
      <div className="nur-bracket-scroll" style={{ overflowX: "auto", paddingTop: 30, paddingBottom: 10 }}>
        <div style={{ position: "relative", height: g.containerHeight, width: g.width, minWidth: g.width }}>
          <svg width={g.width} height={g.containerHeight} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            {g.connectors.map((c) => (
              <g key={c.key} stroke="#D9414C55" strokeWidth="1.5" fill="none" strokeDasharray="3 3">
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
                  top: -26,
                  left: r * (CARD_W + ROUND_GAP),
                  width: CARD_W,
                  textAlign: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 1,
                  color: "#AE9B99",
                }}
              >
                {roundLabel(totalRounds, r)}
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
                        return (
                          <div
                            key={idx}
                            onClick={() => canDecide && slot.id && declareWinner(tournamentId, m, slot.id)}
                            style={{
                              height: "50%",
                              display: "flex",
                              alignItems: "center",
                              cursor: canDecide && slot.id ? "pointer" : "default",
                              borderBottom: idx === 0 ? "1px solid #3D2226" : "none",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                padding: "0 10px",
                                fontSize: 12.5,
                                borderLeft: isWinner ? "2px solid #D9414C" : "2px solid transparent",
                                color: isLoser ? "#8C7876" : isWinner ? "#E8B84D" : "#F3ECEA",
                                textDecoration: isLoser ? "line-through" : "none",
                              }}
                            >
                              {slot.team ? teamLabel(slot.team) : slot.id ? "…" : <span style={{ color: "#4A5054", fontStyle: "italic" }}>bye</span>}
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

      <div style={{ ...styles.nav, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
          <div className="nur-smoke" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative", zIndex: 1 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => {
              setActiveTab("tournaments");
              setNavMenuOpen(false);
            }}
          >
            <img src={logoImg} alt="NUR" style={styles.logoImg} />
            <span style={styles.logo}>
              NUR <span style={{ color: "#D9414C" }}>TOURNAMENTS</span>
            </span>
          </div>
          <button
            onClick={() => {
              setActiveTab("tournaments");
              setNavMenuOpen(false);
            }}
            style={{ ...styles.tabBtn, ...(activeTab === "tournaments" ? styles.tabBtnActive : {}) }}
          >
            <Trophy size={14} /> Турниры
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
          <div style={{ ...styles.modeToggle }}>
            {["5x5", "2x2"].map((m) => (
              <button key={m} onClick={() => setActiveMode(m)} style={{ ...styles.modeBtn, ...(activeMode === m ? styles.modeBtnActive : {}) }}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {!session ? (
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
          ) : (
            <div ref={navAreaRef} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  <Bell size={16} color="#AE9B99" />
                  {(incomingRequests.length > 0 || teamInvites.length > 0) && <span style={styles.notifyDot} />}
                </div>
                {notifOpen && (
                  <div style={{ ...styles.navDropdown, width: 280 }}>
                    <div style={{ position: "relative", zIndex: 1 }}>
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

              <div style={{ position: "relative" }}>
                <div
                  style={styles.avatarPill}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotifOpen(false);
                    setNavMenuOpen(!navMenuOpen);
                  }}
                >
                  <div style={styles.avatarWrapPill}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" style={styles.avatarImgPill} />
                    ) : (
                      <div style={styles.avatarFallbackPill}>{(currentUsername || "?")[0].toUpperCase()}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 12.5, color: "#F3ECEA" }}>{currentUsername}</span>
                  <ChevronDown size={13} color="#AE9B99" />
                </div>

              {navMenuOpen && (
                <div style={styles.navDropdown}>
                  <div className="nur-menu-smoke" />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 6px 12px" }}>
                      <div style={styles.avatarWrapMenu}>
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" style={styles.avatarImgMenu} />
                        ) : (
                          <div style={styles.avatarFallbackMenu}>{(currentUsername || "?")[0].toUpperCase()}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#F3ECEA", fontWeight: 700, fontSize: 14.5 }}>{currentUsername}</div>
                        <div style={{ color: "#AE9B99", fontSize: 11 }}>
                          {teams.filter((t) => t.owner_id === session.user.id).length} команд
                          {incomingRequests.length > 0 ? ` · ${incomingRequests.length} заявка в друзья` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, padding: "0 6px 10px" }}>
                      <button
                        className="nur-btn"
                        style={{ ...styles.accentBtnSm, flex: 1, justifyContent: "center" }}
                        onClick={() => {
                          setActiveTab("teams");
                          openCreateTeam();
                          setNavMenuOpen(false);
                        }}
                      >
                        <ShieldPlus size={13} /> Создать команду
                      </button>
                      <button
                        className="nur-btn"
                        style={{ ...styles.ghostBtnSm, flex: 1, justifyContent: "center" }}
                        onClick={() => {
                          setActiveTab("profile");
                          setNavMenuOpen(false);
                        }}
                      >
                        <UserIcon size={13} /> Профиль
                      </button>
                    </div>

                    <div style={{ height: 1, background: "#3D2226", margin: "0 6px 8px" }} />

                    <div style={{ padding: "0 6px 4px", color: "#8C7876", fontSize: 11 }}>Друзья</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 6px", maxHeight: 160, overflowY: "auto" }}>
                      {friends.length === 0 && <span style={{ ...styles.hint, padding: "4px 0" }}>Пока никого не добавили.</span>}
                      {friends.slice(0, 6).map((f) => (
                        <div key={f.requestId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px" }}>
                          <div style={styles.avatarWrapSm}>
                            {f.avatar_url ? (
                              <img src={f.avatar_url} alt="" style={styles.avatarImgSm} />
                            ) : (
                              <div style={styles.avatarFallbackSm}>{(f.username || "?")[0].toUpperCase()}</div>
                            )}
                          </div>
                          <span style={{ color: "#F3ECEA", fontSize: 12.5, flex: 1 }}>{f.username}</span>
                          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => openChat(f)}>
                            <MessageCircle size={15} color="#E8A33D" />
                            {unreadCounts[f.id] > 0 && <span style={styles.notifyDot} />}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ height: 1, background: "#3D2226", margin: "10px 6px 6px" }} />

                    {profile?.is_admin && (
                      <button
                        style={styles.navDropdownItem}
                        onClick={() => {
                          setActiveTab("admin");
                          setNavMenuOpen(false);
                        }}
                      >
                        <Settings size={15} color="#D9414C" /> Админ-панель
                      </button>
                    )}
                    <button
                      style={{ ...styles.navDropdownItem, color: "#AE9B99" }}
                      onClick={() => {
                        doLogout();
                        setNavMenuOpen(false);
                      }}
                    >
                      <LogOut size={15} /> Выйти
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}
        </div>
      </div>

      <a href="https://t.me/tourNUR" target="_blank" rel="noopener noreferrer" style={styles.promoBanner}>
        <img src={promoImg} alt="NUR FAST CUP" style={styles.promoImg} />
        <div style={styles.promoText}>
          <div style={styles.promoTitle}>
            <Megaphone size={14} color="#D9414C" /> Актуальный турнир анонсирован в Telegram
          </div>
          <div style={styles.promoSub}>Все новости, объявления и регистрация команд — в канале. Нажми, чтобы перейти →</div>
        </div>
      </a>

      <div style={styles.body}>
        {errorMsg && (
          <div style={styles.errorNote}>
            <ShieldAlert size={13} /> {errorMsg}
          </div>
        )}

        {activeTab === "tournaments" && (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ ...styles.stack, flex: "1 1 480px", minWidth: 0 }}>
            <div style={styles.sectionHead}>
              <Swords size={16} color="#D9414C" />
              <span style={styles.sectionTitle}>ТУРНИРЫ · {MODE_LABEL[activeMode]}</span>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeadRow}>
                <div style={styles.cardTitle}>Топ команд · {MODE_LABEL[activeMode]}</div>
                <Trophy size={15} color="#D9414C" />
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ ...styles.hint, marginTop: 10 }}>
                  Пока нет завершённых матчей в этом режиме — рейтинг появится после первых результатов.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  {leaderboard.map((t, i) => (
                    <div key={t.id} style={styles.leaderRow}>
                      <span style={{ ...styles.leaderRank, color: i === 0 ? "#D9414C" : "#AE9B99" }}>
                        {i === 0 ? <Trophy size={13} /> : `#${i + 1}`}
                      </span>
                      <span style={styles.leaderName}>{t.name}</span>
                      <span style={styles.leaderStat}>{t.wins} побед</span>
                      {t.titles > 0 && <span style={styles.leaderStat}>{t.titles} 🏆</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {tourList.length === 0 && <div style={styles.emptyState}>Турниров в этом режиме пока нет. Загляните позже.</div>}

            {tourList.map((tour) => {
              const registeredIds = (tour.tournament_teams || []).map((tt) => tt.team_id);
              const registeredTeams = registeredIds.map((id) => teamMap[id]).filter(Boolean);
              const eligibleTeams = session
                ? teams.filter((t) => t.mode === activeMode && t.owner_id === session.user.id && !registeredIds.includes(t.id))
                : [];
              const isExpanded = expandedTour === tour.id;
              const finalRound = isExpanded && expandedRounds ? expandedRounds[expandedRounds.length - 1] : null;
              const champion = tour.status === "finished" && finalRound && finalRound[0] ? teamMap[finalRound[0].winner_id] : null;

              return (
                <div key={tour.id} style={{ ...styles.card, padding: tour.banner_url ? 0 : 18, overflow: "hidden" }}>
                  {tour.banner_url && <img src={tour.banner_url} alt={tour.name} style={styles.tourBanner} />}
                  <div style={{ padding: tour.banner_url ? 18 : 0 }}>
                    <div style={styles.cardHeadRow}>
                      <div>
                        <div
                          style={{ ...styles.cardTitle, cursor: tour.status !== "registration" ? "pointer" : "default" }}
                          onClick={() => tour.status !== "registration" && toggleExpand(tour.id, true)}
                        >
                          {tour.name}
                        </div>
                        <div style={styles.cardMeta}>
                          {registeredTeams.length}
                          {tour.max_teams ? ` / ${tour.max_teams}` : ""} команд зарегистрировано
                        </div>
                      </div>
                      <span style={{ ...styles.badge, color: STATUS_COLOR[tour.status], borderColor: STATUS_COLOR[tour.status] + "66" }}>
                        {STATUS_LABEL[tour.status]}
                      </span>
                    </div>

                    {tour.prize_pool && (
                      <div style={styles.prizeRow}>
                        <Trophy size={13} color="#D9414C" /> {tour.prize_pool}
                      </div>
                    )}

                    {(tour.announce_at || tour.reg_open_at || tour.start_at) && (
                      <div style={styles.scheduleRow}>
                        {tour.announce_at && <span>Анонс: {formatDateTime(tour.announce_at)}</span>}
                        {tour.reg_open_at && <span>Регистрация: {formatDateTime(tour.reg_open_at)}</span>}
                        {tour.start_at && <span>Старт: {formatDateTime(tour.start_at)}</span>}
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

                    {champion && (
                      <div style={styles.championBanner}>
                        <Trophy size={15} color="#D9414C" />
                        Победитель: <b style={{ color: "#D9414C" }}>{teamLabel(champion)}</b>
                      </div>
                    )}

                    {tour.status === "registration" && (
                      <div style={styles.regRow}>
                        {!session && <span style={styles.hint}>Войдите в профиль, чтобы зарегистрировать команду.</span>}
                      {session && eligibleTeams.length === 0 && (
                        <span style={styles.hint}>
                          У вас нет свободной команды режима {MODE_LABEL[activeMode]}. Создайте её во вкладке «Команды».
                        </span>
                      )}
                      {session && eligibleTeams.length > 0 && (
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
                    </div>
                  )}

                  {tour.status !== "registration" && (
                    <button className="nur-btn" style={{ ...styles.ghostBtnSm, marginTop: 12 }} onClick={() => toggleExpand(tour.id, true)}>
                      Показать сетку
                    </button>
                  )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "0 1 240px", minWidth: 220 }}>
            {ads.map((ad) =>
              ad.is_active && ad.image_url ? (
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
        )}

        {activeTab === "teams" && (
          <div style={styles.stack}>
            <div style={styles.sectionHead}>
              <Users size={16} color="#D9414C" />
              <span style={styles.sectionTitle}>МОИ КОМАНДЫ · {MODE_LABEL[activeMode]}</span>
            </div>

            {!session && <div style={styles.emptyState}>Войдите в профиль, чтобы создавать команды.</div>}

            {session && (
              <>
                {myTeams(activeMode).length === 0 && (
                  <div style={styles.emptyState}>Команд в режиме {MODE_LABEL[activeMode]} пока нет.</div>
                )}
                {myTeams(activeMode).map((t) => (
                  <div key={t.id} style={styles.card}>
                    <div style={styles.cardHeadRow}>
                      <div style={styles.cardTitle}>
                        {t.tag && <span style={{ color: "#D9414C" }}>[{t.tag}] </span>}
                        {t.name}
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

                {!showCreateTeam ? (
                  !profile?.is_admin && myTeams(activeMode).length >= 1 ? (
                    <div style={styles.hint}>Доступна только одна команда в режиме {MODE_LABEL[activeMode]} на аккаунт.</div>
                  ) : (
                    <button className="nur-btn" style={styles.accentBtn} onClick={openCreateTeam}>
                      <Plus size={14} /> Создать команду ({MODE_LABEL[activeMode]})
                    </button>
                  )
                ) : (
                  <div style={styles.card}>
                    <div style={styles.cardHeadRow}>
                      <div style={styles.cardTitle}>Новая команда · {MODE_LABEL[activeMode]}</div>
                      <button style={styles.iconBtn} onClick={() => setShowCreateTeam(false)}>
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <input className="nur-in" placeholder="Название команды" value={teamName} onChange={(e) => setTeamName(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                      <input className="nur-in" placeholder="Тег" value={teamTag} maxLength={5} onChange={(e) => setTeamTag(e.target.value)} style={{ ...styles.input, width: 80 }} />
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "#8C7876" }}>
                      Капитан: {currentUsername}. Остальных игроков можно пригласить после создания команды — приглашённый должен принять запрос.
                    </div>
                    <button className="nur-btn" style={{ ...styles.accentBtn, marginTop: 14 }} onClick={createTeam} disabled={!teamName.trim()}>
                      Создать команду
                    </button>
                  </div>
                )}
              </>
            )}
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
                <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
                  <div style={styles.profileBannerBase}>
                    {profile?.banner_url && <img src={profile.banner_url} alt="" style={styles.profileBannerImg} />}
                  </div>
                  <div style={{ padding: "0 18px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -18 }}>
                      <div style={{ ...styles.avatarWrap, width: 68, height: 68, border: "3px solid #150F10", borderRadius: "50%", background: "#150F10", position: "relative", zIndex: 2 }}>
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" style={{ ...styles.avatarImg, width: 62, height: 62 }} />
                        ) : (
                          <div style={{ ...styles.avatarFallback, width: 62, height: 62 }}>{(currentUsername || "?")[0].toUpperCase()}</div>
                        )}
                      </div>
                      <div style={{ paddingBottom: 4 }}>
                        <div style={styles.cardTitle}>{currentUsername || session.user.email}</div>
                        <div style={styles.cardMeta}>Команд: {teams.filter((t) => t.owner_id === session.user.id).length}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ ...styles.hint, marginBottom: 6 }}>Аватар:</div>
                        <FileChooser
                          disabled={avatarUploading}
                          uploadingLabel="Загружаем…"
                          onChange={(e) => uploadAvatar(e.target.files?.[0])}
                        />
                      </div>
                      <div>
                        <div style={{ ...styles.hint, marginBottom: 6 }}>Баннер профиля:</div>
                        <FileChooser
                          disabled={bannerUploading}
                          uploadingLabel="Загружаем…"
                          onChange={(e) => uploadBanner(e.target.files?.[0])}
                        />
                      </div>
                    </div>
                    {profile?.is_admin && <div style={{ ...styles.hint, marginTop: 10 }}>Статус: администратор</div>}
                    <button className="nur-btn" style={{ ...styles.ghostBtnSm, marginTop: 14 }} onClick={doLogout}>
                      <LogOut size={13} /> Выйти
                    </button>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Друзья ({friends.length})</div>

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
                        <div style={{ ...styles.avatarWrapSm, cursor: "pointer" }} onClick={() => openUserProfile(f)}>
                          {f.avatar_url ? (
                            <img src={f.avatar_url} alt="" style={styles.avatarImgSm} />
                          ) : (
                            <div style={styles.avatarFallbackSm}>{(f.username || "?")[0].toUpperCase()}</div>
                          )}
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
            {session && !profile?.is_admin && (
              <div style={styles.emptyState}>
                У вашего аккаунта нет прав администратора. Их выдаёт владелец сайта вручную в Supabase (Table Editor →
                profiles → is_admin = true для вашей строки).
              </div>
            )}

            {session && profile?.is_admin && (
              <>
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
                          <button
                            className="nur-btn"
                            style={styles.accentBtnSm}
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

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Создать турнир</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <input className="nur-in" placeholder="Название турнира" value={newTourName} onChange={(e) => setNewTourName(e.target.value)} style={{ ...styles.input, flex: 1, minWidth: 180 }} />
                    <select value={newTourMode} onChange={(e) => setNewTourMode(e.target.value)} style={styles.select}>
                      <option value="5x5">5 на 5</option>
                      <option value="2x2">2 на 2</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <input
                      className="nur-in"
                      placeholder="Призовой фонд (например: 1 место — 450₽, 2 место — 100₽)"
                      value={newTourPrize}
                      onChange={(e) => setNewTourPrize(e.target.value)}
                      style={{ ...styles.input, flex: 1, minWidth: 220 }}
                    />
                    <input
                      className="nur-in"
                      type="number"
                      min="2"
                      placeholder="Лимит команд (необязательно)"
                      value={newTourMaxTeams}
                      onChange={(e) => setNewTourMaxTeams(e.target.value)}
                      style={{ ...styles.input, width: 190 }}
                    />
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
          </div>
        )}
      </div>

      {activeTab === "tournaments" &&
        expandedTour &&
        expandedRounds &&
        (() => {
          const modalTour = tournaments.find((t) => t.id === expandedTour);
          if (!modalTour) return null;
          return (
            <div style={styles.modalBackdrop} onClick={() => setExpandedTour(null)}>
              <div style={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
                <div className="nur-menu-smoke" />
                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={styles.modalHeader}>
                    <div>
                      <div style={{ color: "#F3ECEA", fontWeight: 700, fontSize: 16 }}>{modalTour.name}</div>
                      <div style={{ color: "#AE9B99", fontSize: 11.5 }}>Турнирная сетка · {MODE_LABEL[modalTour.mode]}</div>
                    </div>
                    <button style={styles.iconBtn} onClick={() => setExpandedTour(null)}>
                      <X size={16} color="#AE9B99" />
                    </button>
                  </div>
                  <div style={styles.modalBody}>{renderBracket(modalTour.id, expandedRounds, !!profile?.is_admin)}</div>
                </div>
              </div>
            </div>
          );
        })()}

      {viewingUser &&
        (() => {
          const userTeams = teams.filter((t) => (t.team_members || []).some((m) => m.member_name === viewingUser.username));
          const userTournaments = getUserTournamentHistory(viewingUser.username);
          return (
            <div style={styles.modalBackdrop} onClick={() => setViewingUser(null)}>
              <div style={{ ...styles.modalPanel, width: "min(860px, 92vw)", maxWidth: "none", maxHeight: "94vh" }} onClick={(e) => e.stopPropagation()}>
                <div className="nur-menu-smoke" />
                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", maxHeight: "94vh" }}>
                  <div style={{ ...styles.profileBannerBase, height: 170 }}>
                    {viewingUser.banner_url && <img src={viewingUser.banner_url} alt="" style={styles.profileBannerImg} />}
                    <button
                      style={{ ...styles.iconBtn, position: "absolute", top: 10, right: 10, background: "rgba(14,11,12,0.55)" }}
                      onClick={() => setViewingUser(null)}
                    >
                      <X size={16} color="#F3ECEA" />
                    </button>
                  </div>
                  <div style={{ padding: "0 24px", flex: 1, overflow: "auto" }}>
                    <div style={{ ...styles.avatarWrap, width: 84, height: 84, marginTop: -20, border: "3px solid #180F10", borderRadius: "50%", background: "#180F10", position: "relative", zIndex: 2 }}>
                      {viewingUser.avatar_url ? (
                        <img src={viewingUser.avatar_url} alt="" style={{ ...styles.avatarImg, width: 78, height: 78 }} />
                      ) : (
                        <div style={{ ...styles.avatarFallback, width: 78, height: 78, fontSize: 30 }}>{(viewingUser.username || "?")[0].toUpperCase()}</div>
                      )}
                    </div>
                    <div style={{ marginTop: 10, fontFamily: "'Anton', sans-serif", fontSize: 22, color: "#F3ECEA" }}>{viewingUser.username}</div>

                    <div style={{ display: "flex", gap: 8, marginTop: 18, borderBottom: "1px solid #2E1B1E" }}>
                      {[
                        { key: "teams", label: `Команды (${userTeams.length})` },
                        { key: "tournaments", label: `Турниры (${userTournaments.length})` },
                        { key: "friends", label: `Друзья (${viewingUserFriends.length})` },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setViewingUserTab(tab.key)}
                          style={{
                            background: "transparent",
                            border: "none",
                            borderBottom: viewingUserTab === tab.key ? "2px solid #D9414C" : "2px solid transparent",
                            color: viewingUserTab === tab.key ? "#F3ECEA" : "#AE9B99",
                            padding: "8px 4px",
                            marginRight: 14,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ padding: "16px 0 24px" }}>
                      {viewingUserTab === "teams" &&
                        (userTeams.length === 0 ? (
                          <span style={styles.hint}>Не состоит ни в одной команде.</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {userTeams.map((t) => (
                              <span key={t.id} style={styles.memberChip}>
                                {teamLabel(t)}
                              </span>
                            ))}
                          </div>
                        ))}

                      {viewingUserTab === "tournaments" &&
                        (userTournaments.length === 0 ? (
                          <span style={styles.hint}>Пока не участвовал в турнирах.</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {userTournaments.map((t) => (
                              <div key={t.id} style={{ ...styles.friendRow, justifyContent: "space-between" }}>
                                <span style={{ fontSize: 13.5 }}>
                                  {t.name} <span style={{ color: "#8C7876", fontSize: 11.5 }}>· {MODE_LABEL[t.mode]}</span>
                                </span>
                                {t.isChampion && <span style={{ color: "#E8A33D", fontSize: 12.5, fontWeight: 600 }}>🏆 Победитель</span>}
                              </div>
                            ))}
                          </div>
                        ))}

                      {viewingUserTab === "friends" &&
                        (viewingUserFriendsLoading ? (
                          <span style={styles.hint}>Загрузка…</span>
                        ) : viewingUserFriends.length === 0 ? (
                          <span style={styles.hint}>Пока никого не добавили.</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {viewingUserFriends.map((fr) => (
                              <div
                                key={fr.id}
                                style={{ ...styles.friendRow, cursor: "pointer" }}
                                onClick={() => openUserProfile(fr)}
                              >
                                <div style={styles.avatarWrapSm}>
                                  {fr.avatar_url ? (
                                    <img src={fr.avatar_url} alt="" style={styles.avatarImgSm} />
                                  ) : (
                                    <div style={styles.avatarFallbackSm}>{(fr.username || "?")[0].toUpperCase()}</div>
                                  )}
                                </div>
                                <span style={{ flex: 1, fontSize: 13.5, userSelect: "none" }}>{fr.username}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {activeChatFriend && (
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
          <div className="nur-chat-scroll" style={styles.chatMessages}>
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
              onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
              style={{ ...styles.input, flex: 1 }}
            />
            <button className="nur-btn" style={styles.accentBtnSm} onClick={sendChatMessage}>
              Отпр.
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#0E0B0C", color: "#F3ECEA", fontFamily: "'Inter', sans-serif" },
  loadingWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#0E0B0C" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: "14px 22px", borderBottom: "1px solid #2E1B1E", background: "#150F10" },
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
  promoBanner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    maxWidth: 880,
    margin: "18px auto 0",
    padding: 10,
    border: "1px solid #3D2226",
    background: "linear-gradient(90deg, #1C1416 0%, #241618 100%)",
    textDecoration: "none",
    cursor: "pointer",
  },
  promoImg: { width: 64, height: 64, objectFit: "cover", flexShrink: 0 },
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
  tabBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#AE9B99", fontSize: 12.5, padding: "7px 12px", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  tabBtnActive: { background: "#D9414C", color: "#F3ECEA", fontWeight: 600 },
  modeToggle: { display: "flex", gap: 4, background: "#1C1416", padding: 4, border: "1px solid #2E1B1E" },
  modeBtn: { background: "transparent", border: "none", color: "#AE9B99", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5, padding: "7px 12px", cursor: "pointer" },
  modeBtnActive: { background: "#E8A33D", color: "#1C1416", fontWeight: 600 },
  body: { maxWidth: 880, margin: "0 auto", padding: "26px 20px 60px" },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  sectionHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, letterSpacing: 1.5, color: "#E8DCDB" },
  card: { border: "1px solid #3D2226", background: "#1C1416", padding: 18 },
  cardHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
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
  input: { background: "#0E0B0C", border: "1px solid #4A2C2F", color: "#F3ECEA", padding: "9px 10px", fontSize: 13.5, fontFamily: "'Inter', sans-serif", outline: "none" },
  select: { background: "#0E0B0C", border: "1px solid #4A2C2F", color: "#F3ECEA", padding: "9px 10px", fontSize: 13, outline: "none" },
  accentBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#D9414C", color: "#FFFFFF", border: "none", padding: "10px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  accentBtnSm: { display: "flex", alignItems: "center", gap: 6, background: "#D9414C", color: "#FFFFFF", border: "none", padding: "8px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
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
  avatarImg: { width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "1px solid #3D2226" },
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
  notifyDot: { position: "absolute", top: -2, right: -3, width: 7, height: 7, borderRadius: "50%", background: "#D9414C" },
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
  avatarImgSm: { width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #3D2226" },
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
  matchCard: { width: "100%", height: "100%", background: "#150F10", border: "1px solid #3D2226" },
  chatPanel: {
    position: "fixed",
    bottom: 20,
    right: 20,
    width: 300,
    height: 400,
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
    zIndex: -1,
    height: 96,
    background: "linear-gradient(135deg, #2A1216, #150A0B)",
    overflow: "hidden",
  },
  profileBannerImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
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
    maxWidth: "min(900px, 92vw)",
    maxHeight: "86vh",
    width: "100%",
    background: "rgba(24,16,18,0.97)",
    border: "1px solid #3D2226",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #3D2226",
  },
  modalBody: {
    padding: "10px 20px 24px",
    overflow: "auto",
  },
};
