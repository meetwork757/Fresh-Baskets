import { useEffect, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

const KEYS = { base: "pw_base", token: "pw_token", user: "pw_user" };

async function request(path, { method = "GET", token, body, form } = {}) {
  const base = (await AsyncStorage.getItem(KEYS.base) || "").replace(/\/$/, "");
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#8a7d6b" style={styles.input} {...props} />
    </View>
  );
}

function Btn({ title, onPress, ghost, danger }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, ghost && styles.ghost, danger && styles.danger]}>
      <Text style={[styles.btnText, ghost && styles.ghostText]}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState("http://192.168.1.10:5057");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("server");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const savedBase = await AsyncStorage.getItem(KEYS.base);
      const savedToken = await AsyncStorage.getItem(KEYS.token);
      const savedUser = await AsyncStorage.getItem(KEYS.user);
      if (savedBase) setBase(savedBase);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setScreen("home");
      } else if (savedBase) {
        setScreen("welcome");
      }
      setReady(true);
    })();
  }, []);

  async function saveSession(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem(KEYS.token, nextToken);
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(nextUser));
    setScreen("home");
  }

  async function signOut() {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([KEYS.token, KEYS.user]);
    setScreen("welcome");
  }

  if (!ready) {
    return <SafeAreaView style={styles.page}><ActivityIndicator color="#1e5c45" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <Text style={styles.brand}>ProofWork</Text>
        <Text style={styles.tag}>Training record</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {screen === "server" && (
        <ServerScreen base={base} setBase={setBase} busy={busy} onSave={async () => {
          setError(""); setBusy(true);
          try {
            await AsyncStorage.setItem(KEYS.base, base.trim());
            await request("/api/health");
            setScreen("welcome");
          } catch (e) {
            setError("Cannot reach the cloud. Use your computer IP, same Wi-Fi, port 5057.");
          } finally { setBusy(false); }
        }} />
      )}
      {screen === "welcome" && <Welcome onLogin={() => setScreen("login")} onRegister={() => setScreen("register")} />}
      {screen === "login" && (
        <Login busy={busy} onBack={() => setScreen("welcome")} onSubmit={async (email, password) => {
          setError(""); setBusy(true);
          try {
            const data = await request("/api/login", { method: "POST", body: { email, password } });
            await saveSession(data.token, data.user);
          } catch (e) { setError(e.message); } finally { setBusy(false); }
        }} />
      )}
      {screen === "register" && (
        <Register busy={busy} onBack={() => setScreen("welcome")} onSubmit={async (form) => {
          setError(""); setBusy(true);
          try {
            const data = await request("/api/register", { method: "POST", body: form });
            await saveSession(data.token, data.user);
          } catch (e) { setError(e.message); } finally { setBusy(false); }
        }} />
      )}
      {screen === "home" && user?.role === "master" && <Master token={token} onOut={signOut} />}
      {screen === "home" && user?.role === "apprentice" && <Apprentice token={token} user={user} onOut={signOut} />}
      {screen === "home" && user?.role === "admin" && <Admin token={token} onOut={signOut} />}
    </SafeAreaView>
  );
}

function ServerScreen({ base, setBase, onSave, busy }) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>Connect the cloud</Text>
      <Text style={styles.p}>Accounts live on the ProofWork server, so the same login works on any phone.</Text>
      <Field label="Server address" value={base} onChangeText={setBase} autoCapitalize="none" />
      <Btn title={busy ? "Checking..." : "Connect"} onPress={onSave} />
    </ScrollView>
  );
}

function Welcome({ onLogin, onRegister }) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>Proof the work was done.</Text>
      <Text style={styles.p}>Masters and apprentices use their own email and a password they create. No preset login. No hiring, no chat, no worker search.</Text>
      <Btn title="Create your account" onPress={onRegister} />
      <Btn title="Sign in" ghost onPress={onLogin} />
    </ScrollView>
  );
}

function Login({ onSubmit, onBack, busy }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>Sign in</Text>
      <Text style={styles.p}>Use the email and password you created on this app.</Text>
      <Field label="Your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Your password" value={password} onChangeText={setPassword} secureTextEntry />
      <Btn title={busy ? "Signing in..." : "Sign in"} onPress={() => onSubmit(email, password)} />
      <Btn title="Back" ghost onPress={onBack} />
    </ScrollView>
  );
}

function Register({ onSubmit, onBack, busy }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", role: "apprentice", city: "" });
  const [localError, setLocalError] = useState("");
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>Create your login</Text>
      <Text style={styles.p}>Choose your own email and password. Master if you train people. Apprentice if you are learning.</Text>
      {localError ? <Text style={styles.error}>{localError}</Text> : null}
      <Field label="Full name" value={form.name} onChangeText={(v) => set("name", v)} />
      <Field label="Your email" value={form.email} onChangeText={(v) => set("email", v)} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Create a password" value={form.password} onChangeText={(v) => set("password", v)} secureTextEntry />
      <Field label="Repeat password" value={form.confirm} onChangeText={(v) => set("confirm", v)} secureTextEntry />
      <Field label="City" value={form.city} onChangeText={(v) => set("city", v)} />
      <View style={styles.row}>
        <Btn title="Apprentice" ghost={form.role !== "apprentice"} onPress={() => set("role", "apprentice")} />
        <Btn title="Master" ghost={form.role !== "master"} onPress={() => set("role", "master")} />
      </View>
      <Btn title={busy ? "Creating..." : "Create account"} onPress={() => {
        if (form.password.length < 6) { setLocalError("Password must be at least 6 characters."); return; }
        if (form.password !== form.confirm) { setLocalError("Passwords do not match."); return; }
        if (!form.email.includes("@")) { setLocalError("Use your own email."); return; }
        setLocalError("");
        const { confirm, ...payload } = form;
        onSubmit(payload);
      }} />
      <Btn title="Back" ghost onPress={onBack} />
    </ScrollView>
  );
}

function Master({ token, onOut }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: "", trade: "", area: "", city: "" });
  const [msg, setMsg] = useState("");
  async function load() {
    setData(await request("/api/master", { token }));
  }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);
  if (!data) return <ActivityIndicator color="#1e5c45" style={{ marginTop: 40 }} />;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>Workshop</Text>
      <Text style={styles.p}>Share the code only with people you train. This is not a hire page.</Text>
      {msg ? <Text style={styles.error}>{msg}</Text> : null}
      {!data.workshop ? (
        <View>
          {["name", "trade", "area", "city"].map((k) => (
            <Field key={k} label={k} value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} />
          ))}
          <Btn title="Open workshop" onPress={async () => {
            await request("/api/workshop", { method: "POST", token, body: form });
            load();
          }} />
        </View>
      ) : (
        <View>
          <View style={styles.card}>
            <Text style={styles.h2}>{data.workshop.name}</Text>
            <Text style={styles.p}>{data.workshop.trade} · {data.workshop.area}, {data.workshop.city}</Text>
            <Text style={styles.code}>{data.workshop.invite_code}</Text>
            <Btn title="Change code" ghost onPress={async () => { await request("/api/workshop/code", { method: "POST", token, body: {} }); load(); }} />
          </View>
          <Text style={styles.h2}>Waiting</Text>
          {data.pending.map((t) => (
            <View key={t.id} style={styles.card}>
              {t.photo ? <Image source={{ uri: t.photo }} style={styles.photo} /> : null}
              <Text style={styles.h2}>{t.apprentice_name}</Text>
              <Text style={styles.p}>{t.note}</Text>
              <View style={styles.row}>
                <Btn title="Approve" onPress={async () => { await request(`/api/tasks/${t.id}/review`, { method: "POST", token, body: { decision: "approved" } }); load(); }} />
                <Btn title="Reject" danger onPress={async () => { await request(`/api/tasks/${t.id}/review`, { method: "POST", token, body: { decision: "rejected" } }); load(); }} />
              </View>
            </View>
          ))}
          {!data.pending.length && <Text style={styles.p}>No tasks waiting.</Text>}
          <Text style={styles.h2}>Apprentices</Text>
          {data.apprentices.map((a) => (
            <Text key={a.id} style={styles.p}>{a.name} · {a.approved} approved</Text>
          ))}
        </View>
      )}
      <Btn title="Sign out" ghost onPress={onOut} />
    </ScrollView>
  );
}

function Apprentice({ token, user, onOut }) {
  const [data, setData] = useState(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [msg, setMsg] = useState("");
  async function load() { setData(await request("/api/apprentice", { token })); }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);
  if (!data) return <ActivityIndicator color="#1e5c45" style={{ marginTop: 40 }} />;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>{user.name}</Text>
      {msg ? <Text style={styles.error}>{msg}</Text> : null}
      {!data.member ? (
        <View>
          <Text style={styles.p}>Ask your master for the invite code. You cannot browse workshops.</Text>
          <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <Btn title="Join" onPress={async () => {
            try { await request("/api/join", { method: "POST", token, body: { code } }); load(); }
            catch (e) { setMsg(e.message); }
          }} />
        </View>
      ) : (
        <View>
          <View style={styles.card}>
            <Text style={styles.h2}>{data.member.workshop_name}</Text>
            <Text style={styles.p}>{data.member.trade} · {data.member.city}</Text>
            <Text style={styles.p}>Master: {data.member.master_name}</Text>
            <Text style={styles.p}>{data.approved} of {data.complete_at} approved</Text>
            {data.approved >= data.complete_at ? <Text style={styles.stamp}>RECORD READY</Text> : null}
          </View>
          <Field label="Task note" value={note} onChangeText={setNote} placeholder="Sewed a school uniform" />
          <Btn title={photo ? "Photo added" : "Add photo"} ghost onPress={async () => {
            const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
            if (!pick.canceled) setPhoto(pick.assets[0]);
          }} />
          <Btn title="Send to master" onPress={async () => {
            try {
              if (!photo) throw new Error("Add a photo of the work.");
              const form = new FormData();
              form.append("note", note);
              form.append("photo", { uri: photo.uri, name: "task.jpg", type: "image/jpeg" });
              await request("/api/tasks", { method: "POST", token, form });
              setNote(""); setPhoto(null); load();
            } catch (e) { setMsg(e.message); }
          }} />
          <Text style={styles.h2}>Your tasks</Text>
          {data.tasks.map((t) => (
            <View key={t.id} style={styles.card}>
              {t.photo ? <Image source={{ uri: t.photo }} style={styles.photo} /> : null}
              <Text style={styles.p}>{t.status.toUpperCase()} · {t.note}</Text>
            </View>
          ))}
        </View>
      )}
      <Btn title="Sign out" ghost onPress={onOut} />
    </ScrollView>
  );
}

function Admin({ token, onOut }) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  async function load() { setData(await request("/api/admin", { token })); }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);
  if (!data) return <ActivityIndicator color="#1e5c45" style={{ marginTop: 40 }} />;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.h1}>Admin cloud</Text>
      <Text style={styles.p}>{data.stats.users} accounts · {data.stats.workshops} workshops · {data.stats.approved}/{data.stats.tasks} approved</Text>
      {msg ? <Text style={styles.error}>{msg}</Text> : null}
      <Text style={styles.h2}>Accounts</Text>
      {data.users.map((u) => (
        <View key={u.id} style={styles.card}>
          <Text style={styles.h2}>{u.name}</Text>
          <Text style={styles.p}>{u.email} · {u.role}{u.suspended ? " · suspended" : ""}</Text>
          {u.role !== "admin" && (
            <Btn
              title={u.suspended ? "Restore" : "Suspend"}
              danger={!u.suspended}
              onPress={async () => {
                await request("/api/admin/user", { method: "POST", token, body: { user_id: u.id, action: u.suspended ? "restore" : "suspend" } });
                load();
              }}
            />
          )}
        </View>
      ))}
      <Text style={styles.h2}>Workshops</Text>
      {data.shops.map((s) => (
        <Text key={s.id} style={styles.p}>{s.name} · {s.trade} · code {s.invite_code}</Text>
      ))}
      <Btn title="Sign out" ghost onPress={onOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f3ecdf" },
  top: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  brand: { fontSize: 22, fontWeight: "700", color: "#1a1814" },
  tag: { color: "#6e4e28", letterSpacing: 1.2, fontSize: 12, textTransform: "uppercase" },
  body: { padding: 20, paddingBottom: 48 },
  h1: { fontSize: 32, fontWeight: "700", color: "#1a1814", marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: "700", color: "#1a1814", marginTop: 8 },
  p: { color: "#4d463c", fontSize: 16, lineHeight: 22, marginBottom: 10 },
  label: { color: "#6e4e28", marginBottom: 6 },
  input: { backgroundColor: "#fffaf3", borderWidth: 1, borderColor: "#e2d5c3", borderRadius: 14, padding: 14, fontSize: 16, color: "#1a1814" },
  btn: { backgroundColor: "#1a1814", borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, marginTop: 8, alignItems: "center" },
  ghost: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#1a1814" },
  danger: { backgroundColor: "#8d3b32" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  ghostText: { color: "#1a1814" },
  card: { backgroundColor: "#fffaf3", borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e2d5c3" },
  code: { fontSize: 28, letterSpacing: 4, fontWeight: "700", marginVertical: 8 },
  photo: { width: "100%", height: 180, borderRadius: 12, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  error: { backgroundColor: "#fff4d8", color: "#6e4e28", marginHorizontal: 20, padding: 10, borderRadius: 12 },
  stamp: { color: "#8d3b32", fontWeight: "700", letterSpacing: 1 },
});
