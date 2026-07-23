import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import logoImg from "./logo.jpg";
import promoImg from "./promo.jpg";
import {
  Trophy,
  LogIn,
  LogOut,
  Users,
  UserPlus,
  Plus,
  X,
  Swords,
  Settings,
  Trash2,
  ShieldCheck,
  Loader2,
  ShieldAlert,
  Megaphone,
} from "lucide-react";

const CARD_W = 200;
const CARD_H = 60;
const SLOT0 = 86;
const ROUND_GAP = 92;

const MODE_LABEL = { "5x5": "5 НА 5", "2x2": "2 НА 2" };
const STATUS_LABEL = { registration: "Регистрация", live: "Идёт турнир", finished: "Завершён" };
const STATUS_COLOR = { registration: "#6B7280", live: "#E4283A", finished: "#5C5254" };

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

  const [authScreen, setAuthScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamTag, setTeamTag] = useState("");
  const [teamExtras, setTeamExtras] = useState([]);
  const [teamSuggestions, setTeamSuggestions] = useState({});
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState(null);
  const [addMemberQuery, setAddMemberQuery] = useState({});
  const [addMemberResults, setAddMemberResults] = useState({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState([]);

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
      .select("tournament_id, round, winner_id")
      .not("winner_id", "is", null);
    if (error) return setErrorMsg(error.message);
    setAllMatches(data || []);
  }, []);

  const refreshFriends = useCallback(async (userId) => {
    if (!userId) {
      setFriends([]);
      return;
    }
    const { data, error } = await supabase
      .from("friends")
      .select("id, friend:profiles!friends_friend_id_fkey(id, username, avatar_url)")
      .eq("user_id", userId);
    if (error) return;
    setFriends(data || []);
  }, []);

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
    return () => sub.subscription.unsubscribe();
  }, [refreshTeams, refreshTournaments, refreshAllMatches]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setFriends([]);
      return;
    }
    supabase
      .from("profiles")
      .select("username, is_admin, avatar_url")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) return setErrorMsg(error.message);
        setProfile(data);
      });
    refreshFriends(session.user.id);
  }, [session, refreshFriends]);

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

  const searchFriendCandidates = async (query) => {
    const q = query.trim();
    if (q.length < 2) {
      setFriendResults([]);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("id, username, avatar_url").ilike("username", `%${q}%`).limit(6);
    if (error) return;
    const already = friends.map((f) => f.friend?.id);
    const results = (data || []).filter((p) => p.id !== session?.user.id && !already.includes(p.id));
    setFriendResults(results.slice(0, 5));
  };

  const addFriend = async (friendId) => {
    const { error } = await supabase.from("friends").insert({ user_id: session.user.id, friend_id: friendId });
    if (error) return setErrorMsg("Не удалось добавить в друзья (возможно, уже добавлен).");
    setFriendQuery("");
    setFriendResults([]);
    refreshFriends(session.user.id);
  };

  const removeFriend = async (friendRowId) => {
    const { error } = await supabase.from("friends").delete().eq("id", friendRowId);
    if (error) return setErrorMsg(error.message);
    refreshFriends(session.user.id);
  };

  const currentUsername = profile?.username || null;

  const maxForMode = (mode) => (mode === "5x5" ? 5 : 2);

  const openCreateTeam = () => {
    setTeamName("");
    setTeamTag("");
    setTeamExtras(Array(maxForMode(activeMode) - 1).fill(""));
    setTeamSuggestions({});
    setShowCreateTeam(true);
  };

  const searchUsers = async (index, query) => {
    const q = query.trim();
    if (q.length < 2) {
      setTeamSuggestions((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    const { data, error } = await supabase.from("profiles").select("username").ilike("username", `%${q}%`).limit(6);
    if (error) return;
    const taken = [currentUsername, ...teamExtras].filter(Boolean);
    const results = (data || []).map((d) => d.username).filter((n) => !taken.includes(n));
    setTeamSuggestions((prev) => ({ ...prev, [index]: results.slice(0, 5) }));
  };

  const pickSuggestion = (index, name) => {
    const next = [...teamExtras];
    next[index] = name;
    setTeamExtras(next);
    setTeamSuggestions((prev) => ({ ...prev, [index]: [] }));
  };

  const createTeam = async () => {
    if (!session || !teamName.trim()) return;
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
    if (error) return setErrorMsg(error.message);
    const members = [currentUsername, ...teamExtras.map((s) => s.trim()).filter(Boolean)].slice(0, max);
    const { error: mErr } = await supabase
      .from("team_members")
      .insert(members.map((m) => ({ team_id: team.id, member_name: m })));
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
    const { data, error } = await supabase.from("profiles").select("username").ilike("username", `%${q}%`).limit(6);
    if (error) return;
    const results = (data || []).map((d) => d.username).filter((n) => !taken.includes(n));
    setAddMemberResults((prev) => ({ ...prev, [teamId]: results.slice(0, 5) }));
  };

  const addMemberToTeam = async (team, username) => {
    if ((team.team_members || []).length >= team.max_size) {
      setErrorMsg("Состав команды уже заполнен.");
      return;
    }
    const { error } = await supabase.from("team_members").insert({ team_id: team.id, member_name: username });
    if (error) return setErrorMsg(error.message);
    setAddMemberQuery((prev) => ({ ...prev, [team.id]: "" }));
    setAddMemberResults((prev) => ({ ...prev, [team.id]: [] }));
    refreshTeams();
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

  const loadBracket = async (tournamentId) => {
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
      stats[m.winner_id].wins += 1;
      if (m.round === maxRoundByTour[m.tournament_id]) stats[m.winner_id].titles += 1;
    });
    return Object.values(stats)
      .map((s) => ({ ...s, name: teamMap[s.id] ? teamLabel(teamMap[s.id]) : "—" }))
      .sort((a, b) => b.wins - a.wins || b.titles - a.titles)
      .slice(0, 5);
  };

  if (authLoading) {
    return (
      <div style={styles.loadingWrap}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} color="#E4283A" />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A08A8C", fontSize: 13 }}>
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
      <div style={{ overflowX: "auto", paddingTop: 30, paddingBottom: 10 }}>
        <div style={{ position: "relative", height: g.containerHeight, width: g.width, minWidth: g.width }}>
          <svg width={g.width} height={g.containerHeight} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            {g.connectors.map((c) => (
              <g key={c.key} stroke="#E4283A55" strokeWidth="1.5" fill="none" strokeDasharray="3 3">
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
                  color: "#A08A8C",
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
                              borderBottom: idx === 0 ? "1px solid #3A1418" : "none",
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
                                borderLeft: isWinner ? "2px solid #E4283A" : "2px solid transparent",
                                color: isLoser ? "#7A6668" : isWinner ? "#F5C242" : "#F1E7E7",
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
        .nur-in::placeholder { color: #7A6668; }
        .nur-btn:disabled { opacity: .35; cursor: not-allowed; }
        @keyframes nur-smoke-drift {
          0%   { transform: translate(-3%, 0%) scale(1); }
          50%  { transform: translate(3%, -4%) scale(1.12); }
          100% { transform: translate(-3%, 0%) scale(1); }
        }
        .nur-smoke {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.9;
          background:
            radial-gradient(ellipse 40% 70% at 15% 30%, rgba(228,40,58,0.30), transparent 60%),
            radial-gradient(ellipse 35% 60% at 85% 60%, rgba(228,40,58,0.20), transparent 60%),
            radial-gradient(ellipse 50% 80% at 50% 100%, rgba(255,122,69,0.14), transparent 65%);
          filter: blur(26px);
          animation: nur-smoke-drift 16s ease-in-out infinite;
        }
      `}</style>

      <div style={{ ...styles.nav, position: "relative", overflow: "hidden" }}>
        <div className="nur-smoke" />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <img src={logoImg} alt="NUR" style={styles.logoImg} />
          <span style={styles.logo}>
            NUR <span style={{ color: "#E4283A" }}>TOURNAMENTS</span>
          </span>
        </div>

        <div style={{ ...styles.tabsRow, position: "relative", zIndex: 1 }}>
          {[
            ["tournaments", "Турниры", Trophy],
            ["teams", "Команды", Users],
            ["profile", "Профиль", session ? LogOut : LogIn],
            ["admin", "Админ", Settings],
          ].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{ ...styles.tabBtn, ...(activeTab === key ? styles.tabBtnActive : {}) }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div style={{ ...styles.modeToggle, position: "relative", zIndex: 1 }}>
          {["5x5", "2x2"].map((m) => (
            <button key={m} onClick={() => setActiveMode(m)} style={{ ...styles.modeBtn, ...(activeMode === m ? styles.modeBtnActive : {}) }}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <a href="https://t.me/tourNUR" target="_blank" rel="noopener noreferrer" style={styles.promoBanner}>
        <img src={promoImg} alt="NUR FAST CUP" style={styles.promoImg} />
        <div style={styles.promoText}>
          <div style={styles.promoTitle}>
            <Megaphone size={14} color="#E4283A" /> Актуальный турнир анонсирован в Telegram
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
          <div style={styles.stack}>
            <div style={styles.sectionHead}>
              <Swords size={16} color="#E4283A" />
              <span style={styles.sectionTitle}>ТУРНИРЫ · {MODE_LABEL[activeMode]}</span>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeadRow}>
                <div style={styles.cardTitle}>Топ команд · {MODE_LABEL[activeMode]}</div>
                <Trophy size={15} color="#E4283A" />
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ ...styles.hint, marginTop: 10 }}>
                  Пока нет завершённых матчей в этом режиме — рейтинг появится после первых результатов.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  {leaderboard.map((t, i) => (
                    <div key={t.id} style={styles.leaderRow}>
                      <span style={{ ...styles.leaderRank, color: i === 0 ? "#E4283A" : "#A08A8C" }}>
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
                        <div style={styles.cardTitle}>{tour.name}</div>
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
                        <Trophy size={13} color="#E4283A" /> {tour.prize_pool}
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
                                      <span key={i} style={{ ...styles.memberChip, color: "#A08A8C" }}>
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
                        <Trophy size={15} color="#E4283A" />
                        Победитель: <b style={{ color: "#E4283A" }}>{teamLabel(champion)}</b>
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
                      {isExpanded ? "Скрыть сетку" : "Показать сетку"}
                    </button>
                  )}
                  {isExpanded && renderBracket(tour.id, expandedRounds, false)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "teams" && (
          <div style={styles.stack}>
            <div style={styles.sectionHead}>
              <Users size={16} color="#E4283A" />
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
                        {t.tag && <span style={{ color: "#E4283A" }}>[{t.tag}] </span>}
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
                            placeholder="Никнейм тиммейта для добавления"
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
                            {addMemberResults[t.id].map((name) => (
                              <div key={name} style={{ ...styles.suggestItem, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>{name}</span>
                                <button className="nur-btn" style={styles.accentBtnSm} onClick={() => addMemberToTeam(t, name)}>
                                  <Plus size={12} /> Добавить
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
                  <button className="nur-btn" style={styles.accentBtn} onClick={openCreateTeam}>
                    <Plus size={14} /> Создать команду ({MODE_LABEL[activeMode]})
                  </button>
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
                    <div style={{ marginTop: 10, fontSize: 12, color: "#7A6668" }}>Капитан: {currentUsername}. Добавьте остальных участников состава:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {teamExtras.map((val, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <input
                            className="nur-in"
                            placeholder={`Никнейм игрока ${i + 2} (необязательно)`}
                            value={val}
                            onChange={(e) => {
                              const next = [...teamExtras];
                              next[i] = e.target.value;
                              setTeamExtras(next);
                              searchUsers(i, e.target.value);
                            }}
                            style={styles.input}
                          />
                          {(teamSuggestions[i] || []).length > 0 && (
                            <div style={styles.suggestBox}>
                              {teamSuggestions[i].map((name) => (
                                <div key={name} style={styles.suggestItem} onClick={() => pickSuggestion(i, name)}>
                                  {name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
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
              <ShieldCheck size={16} color="#E4283A" />
              <span style={styles.sectionTitle}>ПРОФИЛЬ</span>
            </div>

            {session ? (
              <>
                <div style={styles.card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={styles.avatarWrap}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" style={styles.avatarImg} />
                      ) : (
                        <div style={styles.avatarFallback}>{(currentUsername || "?")[0].toUpperCase()}</div>
                      )}
                    </div>
                    <div>
                      <div style={styles.cardTitle}>{currentUsername || session.user.email}</div>
                      <div style={styles.cardMeta}>Команд: {teams.filter((t) => t.owner_id === session.user.id).length}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ ...styles.hint, marginBottom: 6 }}>{avatarUploading ? "Загружаем аватар…" : "Сменить аватар:"}</div>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={avatarUploading}
                      onChange={(e) => uploadAvatar(e.target.files?.[0])}
                      style={{ color: "#A08A8C", fontSize: 12.5 }}
                    />
                  </div>
                  {profile?.is_admin && <div style={{ ...styles.hint, marginTop: 6 }}>Статус: администратор</div>}
                  <button className="nur-btn" style={{ ...styles.ghostBtnSm, marginTop: 14 }} onClick={doLogout}>
                    <LogOut size={13} /> Выйти
                  </button>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Друзья ({friends.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {friends.length === 0 && <span style={styles.hint}>Пока никого не добавили.</span>}
                    {friends.map((f) => (
                      <div key={f.id} style={styles.friendRow}>
                        <div style={styles.avatarWrapSm}>
                          {f.friend?.avatar_url ? (
                            <img src={f.friend.avatar_url} alt="" style={styles.avatarImgSm} />
                          ) : (
                            <div style={styles.avatarFallbackSm}>{(f.friend?.username || "?")[0].toUpperCase()}</div>
                          )}
                        </div>
                        <span style={{ flex: 1, fontSize: 13.5 }}>{f.friend?.username}</span>
                        <button style={styles.iconBtn} onClick={() => removeFriend(f.id)}>
                          <X size={13} color="#FF5A5A" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: "relative", marginTop: 12 }}>
                    <input
                      className="nur-in"
                      placeholder="Никнейм, чтобы добавить в друзья"
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
                            <button className="nur-btn" style={styles.accentBtnSm} onClick={() => addFriend(p.id)}>
                              <UserPlus size={12} /> Добавить
                            </button>
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
              <Settings size={16} color="#E4283A" />
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
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setNewTourBannerFile(e.target.files?.[0] || null)}
                      style={{ color: "#A08A8C", fontSize: 12.5 }}
                    />
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
                            {tour.name} <span style={{ color: "#7A6668", fontSize: 12 }}>· {MODE_LABEL[tour.mode]}</span>
                          </div>
                          <div style={styles.cardMeta}>
                            {registeredTeams.length}
                            {tour.max_teams ? ` / ${tour.max_teams}` : ""} команд · {STATUS_LABEL[tour.status]}
                          </div>
                          {tour.prize_pool && (
                            <div style={{ ...styles.prizeRow, marginTop: 6 }}>
                              <Trophy size={12} color="#E4283A" /> {tour.prize_pool}
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
                            <span key={t.id} style={styles.memberChip}>
                              {teamLabel(t)}
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
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#0B0707", color: "#F1E7E7", fontFamily: "'Inter', sans-serif" },
  loadingWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#0B0707" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: "14px 22px", borderBottom: "1px solid #2A1315", background: "#100909" },
  logoImg: { width: 38, height: 38, borderRadius: 7, objectFit: "cover", boxShadow: "0 0 0 1px #3A1418, 0 0 14px #E4283A55" },
  logo: {
    fontFamily: "'Anton', 'Teko', sans-serif",
    fontWeight: 400,
    fontSize: 22,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#F1E7E7",
    textShadow: "0 0 18px #E4283A66",
  },
  promoBanner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    maxWidth: 880,
    margin: "18px auto 0",
    padding: 10,
    border: "1px solid #3A1418",
    background: "linear-gradient(90deg, #170D0E 0%, #1F1011 100%)",
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
    color: "#F1E7E7",
  },
  promoSub: { fontSize: 12, color: "#A08A8C" },
  tabsRow: { display: "flex", gap: 4, background: "#170D0E", padding: 4, border: "1px solid #2A1315" },
  tabBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#A08A8C", fontSize: 12.5, padding: "7px 12px", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  tabBtnActive: { background: "#E4283A", color: "#F1E7E7", fontWeight: 600 },
  modeToggle: { display: "flex", gap: 4, background: "#170D0E", padding: 4, border: "1px solid #2A1315" },
  modeBtn: { background: "transparent", border: "none", color: "#A08A8C", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5, padding: "7px 12px", cursor: "pointer" },
  modeBtnActive: { background: "#FF7A45", color: "#170D0E", fontWeight: 600 },
  body: { maxWidth: 880, margin: "0 auto", padding: "26px 20px 60px" },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  sectionHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, letterSpacing: 1.5, color: "#E6D9DA" },
  card: { border: "1px solid #3A1418", background: "#170D0E", padding: 18 },
  cardHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontSize: 15.5, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: "#A08A8C", marginTop: 3 },
  badge: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: 0.5, border: "1px solid #4A2226", padding: "3px 8px", color: "#E6D9DA", whiteSpace: "nowrap" },
  championBanner: { marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "8px 12px", border: "1px solid #E4283A55", background: "#E4283A14" },
  tourBanner: { width: "100%", height: 140, objectFit: "cover", display: "block" },
  tourBannerSm: { width: 56, height: 56, objectFit: "cover", flexShrink: 0 },
  prizeRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: "#F1E7E7" },
  scheduleRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    fontSize: 11.5,
    color: "#A08A8C",
    fontFamily: "'JetBrains Mono', monospace",
  },
  regRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
  hint: { fontSize: 12, color: "#7A6668" },
  input: { background: "#0B0707", border: "1px solid #4A2226", color: "#F1E7E7", padding: "9px 10px", fontSize: 13.5, fontFamily: "'Inter', sans-serif", outline: "none" },
  select: { background: "#0B0707", border: "1px solid #4A2226", color: "#F1E7E7", padding: "9px 10px", fontSize: 13, outline: "none" },
  accentBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#E4283A", color: "#FFFFFF", border: "none", padding: "10px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  accentBtnSm: { display: "flex", alignItems: "center", gap: 6, background: "#E4283A", color: "#FFFFFF", border: "none", padding: "8px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  ghostBtnSm: { display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "#A08A8C", border: "1px solid #4A2226", padding: "8px 12px", fontSize: 12.5, cursor: "pointer" },
  iconBtn: { background: "transparent", border: "1px solid #4A2226", padding: 6, cursor: "pointer", color: "#A08A8C" },
  segBtn: { flex: 1, background: "#0B0707", border: "1px solid #4A2226", color: "#A08A8C", padding: "8px 0", fontSize: 12.5, cursor: "pointer" },
  segBtnActive: { background: "#E4283A", color: "#FFFFFF", borderColor: "#E4283A", fontWeight: 600 },
  memberChip: { fontSize: 12, background: "#0B0707", border: "1px solid #2A1315", padding: "4px 9px", color: "#E6D9DA" },
  suggestBox: {
    position: "absolute",
    top: "calc(100% + 2px)",
    left: 0,
    right: 0,
    zIndex: 5,
    background: "#170D0E",
    border: "1px solid #4A2226",
    maxHeight: 160,
    overflowY: "auto",
  },
  suggestItem: { padding: "8px 10px", fontSize: 13, color: "#F1E7E7", cursor: "pointer" },
  avatarWrap: { width: 56, height: 56, flexShrink: 0 },
  avatarImg: { width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "1px solid #3A1418" },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#3A1418",
    color: "#E4283A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 22,
  },
  friendRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: "#0B0707", border: "1px solid #2A1315" },
  avatarWrapSm: { width: 32, height: 32, flexShrink: 0 },
  avatarImgSm: { width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #3A1418" },
  avatarFallbackSm: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#3A1418",
    color: "#E4283A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Anton', sans-serif",
    fontSize: 14,
  },
  errorNote: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#FF5A5A", marginBottom: 14, padding: "8px 12px", border: "1px solid #FF5A5A33" },
  leaderRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#0B0707", border: "1px solid #2A1315" },
  leaderRank: { width: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, display: "flex", alignItems: "center" },
  leaderName: { flex: 1, fontSize: 13 },
  leaderStat: { fontSize: 11.5, color: "#A08A8C", fontFamily: "'JetBrains Mono', monospace" },
  matchCard: { width: "100%", height: "100%", background: "#100909", border: "1px solid #3A1418" },
};
