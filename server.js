const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const fetch = require("node-fetch"); // Ensure you install version 2: npm install node-fetch@2

const app = express();
app.use(cors());
app.use(express.json());

// Image upload setup
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));

// --- FIREBASE INITIALIZATION ---
// Ensure serviceAccountKey.json is in the same folder
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// --- ROUTES ---

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/**
 * REGISTER USER
 */
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const existing = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.json({ success: false, message: "User already exists" });
    }

    const userRef = await db.collection("users").add({
      name,
      email,
      password,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      user: {
        id: userRef.id,
        name,
        email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Register failed" });
  }
});

/**
 * LOGIN USER
 */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const snapshot = await db
      .collection("users")
      .where("email", "==", email)
      .where("password", "==", password)
      .get();

    if (snapshot.empty) {
      return res.json({ success: false });
    }

    const userDoc = snapshot.docs[0];

    res.json({
      success: true,
      user: {
        id: userDoc.id,
        ...userDoc.data(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/**
 * SUBMIT COMPLAINT
 */
app.post("/submit-complaint", upload.any(), async (req, res) => {
  try {
    const {
      userId,
      userName,
      mobile,
      description,
      lat,
      lng
    } = req.body;

    if (!userId || !userName) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const imagePath =
      req.files && req.files.length > 0
        ? req.files[0].path
        : null;

    let location = null;
    let address = "Location not provided";

    if (lat && lng) {
      location = new admin.firestore.GeoPoint(
        parseFloat(lat),
        parseFloat(lng)
      );

      const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

      const geoResponse = await fetch(geoUrl, {
        headers: {
          "User-Agent": "NagrikRakshak/1.0 (contact: shikhar0538@gmail.com)",
        },
      });

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData?.display_name) {
          address = geoData.display_name
            .split(", ")
            .slice(0, 3)
            .join(", ");
        }
      }
    }

    // Saving to Database
    await db.collection("complaints").add({
      userId,
      userName,
      mobile,
      description,
      location,
      address,
      imagePath,
      department: null,
      priority: null,
      status: "new",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clientCreatedAt: new Date().toISOString(),
      actions: [{
        action: "Complaint Submitted",
        timestamp: new Date().toISOString(),
        by: userName
      }],
      deadline: null,
      overdue: false,
      lastUpdated: new Date().toISOString()
    });

    res.json({ success: true, message: "Complaint saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save complaint" });
  }
});

/**
 * UPDATE COMPLAINT STATUS
 */
app.post("/update-complaint-status", async (req, res) => {
  try {
    const { complaintId, status, adminName } = req.body;

    if (!complaintId || !status) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const complaintRef = db.collection("complaints").doc(complaintId);
    const complaintDoc = await complaintRef.get();

    if (!complaintDoc.exists) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    const currentData = complaintDoc.data();
    const actions = currentData.actions || [];

    // Add new action
    actions.push({
      action: `Status changed to ${status}`,
      timestamp: new Date().toISOString(),
      by: adminName || "Admin"
    });

    // Update complaint
    await complaintRef.update({
      status: status,
      actions: actions,
      lastUpdated: new Date().toISOString()
    });

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Update failed: " + err.message });
  }
});

/**
 * ADMIN – ALL COMPLAINTS
 */
app.get("/complaints", async (req, res) => {
  try {
    const snapshot = await db
      .collection("complaints")
      .orderBy("createdAt", "desc")
      .get();

    const complaints = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      const now = new Date();
      let timePassed = "";
      let hoursPassed = 0;
      
      if (createdAt) {
        const diffMs = now - createdAt;
        hoursPassed = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(hoursPassed / 24);
        const hours = hoursPassed % 24;
        
        if (days > 0) {
          timePassed = `${days}d ${hours}h`;
        } else {
          timePassed = `${hours}h`;
        }
      }
      
      let isOverdue = data.overdue || false;
      if (data.deadline && data.status !== "resolved") {
        const deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline);
        if (deadline && now > deadline) {
          isOverdue = true;
        }
      }

      return {
        id: doc.id,
        ...data,
        createdAt: createdAt ? createdAt.toISOString() : null,
        deadline: data.deadline && data.deadline.toDate ? data.deadline.toDate().toISOString() : null,
        timePassed,
        hoursPassed,
        isOverdue,
        actions: data.actions || []
      };
    });

    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * USER – MY COMPLAINTS
 */
app.get("/my-complaints", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const complaintsRef = db.collection("complaints");

    let snapshot;
    try {
      snapshot = await complaintsRef
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (err) {
      console.warn("OrderBy failed, fetching without orderBy:", err.message);
      snapshot = await complaintsRef.where("userId", "==", userId).get();
    }

    const complaints = snapshot.docs.map(doc => {
      const data = doc.data();
      
      let createdAt = new Date();
      if (data.createdAt) {
        if (data.createdAt.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (typeof data.createdAt === 'string') {
          createdAt = new Date(data.createdAt);
        }
      }
      
      const actions = data.actions || [];
      const processedActions = actions.map(action => ({
        ...action,
        timestamp: action.timestamp ? new Date(action.timestamp) : new Date()
      }));

      return {
        id: doc.id,
        description: data.description || "",
        status: data.status || "Pending",
        address: data.address || "",
        imagePath: data.imagePath || "",
        createdAt: createdAt,
        actions: processedActions,
        priority: data.priority || "Low"
      };
    });

    res.json(complaints);
  } catch (err) {
    console.error("Fetch complaints failed:", err);
    res.status(500).json({ error: "Failed to fetch complaints", details: err.message });
  }
});

// --- BOT QUERY SECTION ---

const FAQS = [
  { keywords: ["file", "register", "complaint", "submit"], answer: "You can submit a complaint by filling the form on the dashboard. Add details and an optional image." },
  { keywords: ["status", "track", "check"], answer: "You can check your complaint status by asking me: 'What's the status of my complaints?'" },
  { keywords: ["pending", "open"], answer: "Ask me 'Do I have any pending complaints?' to see open issues." },
  { keywords: ["resolved", "closed", "done"], answer: "Ask me 'What complaints have been resolved?' to see completed cases." },
  { keywords: ["time", "how long", "wait"], answer: "High priority: 24h, Medium: 72h, Low: 1 week." },
  { keywords: ["department", "who handles"], answer: "Complaints are routed to Water, Electricity, PWD, Police, etc." },
  { keywords: ["location", "address"], answer: "Please select your area from the dropdown or allow location access." },
  { keywords: ["image", "photo", "upload"], answer: "Uploading an image helps authorities understand the issue better." },
  { keywords: ["privacy", "data"], answer: "Your personal details are secure and only used for complaint resolution." },
  { keywords: ["login", "account"], answer: "Create an account or login to manage your complaints." },
  { keywords: ["contact", "help"], answer: "I can guide you, or you can use the complaint form for official assistance." },
  { keywords: ["urgent", "emergency"], answer: "For life-threatening emergencies, please contact emergency services immediately." }
];

app.post("/bot-query", (req, res) => {
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.json({ reply: "I'm here to help you. Please share your concern." });
  }

  const text = message.toLowerCase();
  const words = text.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);

  let bestMatch = null;
  let bestScore = 0;

  for (const faq of FAQS) {
    let score = 0;
    for (const keyword of faq.keywords) {
      if (text.includes(keyword)) score++; 
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch && bestScore >= 1) {
    return res.json({ reply: bestMatch.answer });
  }

  const fallbackReplies = [
    "That's an important concern. The platform is designed to handle this.",
    "Thanks for bringing this up. Your concern is valid.",
    "This is something the platform accounts for.",
    "Your concern is valid, and we support resolution through authorities."
  ];

  const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
  res.json({ reply });
});

/**
 * BOT - CHECK COMPLAINT STATUS
 */
app.post("/bot-check-status", async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId) {
      return res.json({ reply: "I need to know who you are to check your complaints. Please log in first." });
    }

    const text = message.toLowerCase();
    
    const isAskingRecent = text.includes('recent') || text.includes('latest') || text.includes('new');
    const isAskingPending = text.includes('pending') || text.includes('open') || text.includes('waiting');
    const isAskingResolved = text.includes('resolved') || text.includes('closed') || text.includes('done');

    const complaintsRef = db.collection("complaints");
    let snapshot;
    try {
      snapshot = await complaintsRef
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (err) {
      snapshot = await complaintsRef.where("userId", "==", userId).get();
    }

    if (snapshot.empty) {
      return res.json({ reply: "You haven't submitted any complaints yet." });
    }

    const complaints = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
      const now = new Date();
      const hoursPassed = Math.floor((now - createdAt) / (1000 * 60 * 60));
      
      return {
        id: doc.id,
        description: data.description || "",
        status: data.status || "new",
        priority: data.priority || "Low",
        createdAt: createdAt,
        hoursPassed: hoursPassed,
        address: data.address || "Unknown location"
      };
    });

    let filteredComplaints = complaints;
    
    if (isAskingPending) {
      filteredComplaints = complaints.filter(c => c.status !== "resolved");
    } else if (isAskingResolved) {
      filteredComplaints = complaints.filter(c => c.status === "resolved");
    } else if (isAskingRecent) {
      filteredComplaints = complaints.slice(0, 3);
    }

    if (filteredComplaints.length === 0) {
      if (isAskingPending) return res.json({ reply: "Great news! You have no pending complaints. 🎉" });
      if (isAskingResolved) return res.json({ reply: "You haven't had any complaints resolved yet." });
      return res.json({ reply: "I couldn't find any complaints matching your request." });
    }

    let reply = "";
    if (isAskingRecent) reply = "Here are your recent complaints:\n\n";
    else if (isAskingPending) reply = `You have ${filteredComplaints.length} pending complaints:\n\n`;
    else if (isAskingResolved) reply = `You have ${filteredComplaints.length} resolved complaints:\n\n`;
    else reply = `You have ${complaints.length} complaints in total:\n\n`;

    filteredComplaints.forEach((c, index) => {
      const days = Math.floor(c.hoursPassed / 24);
      const hours = c.hoursPassed % 24;
      const timeAgo = days > 0 ? `${days}d ${hours}h ago` : `${c.hoursPassed}h ago`;
      
      const statusEmoji = { 'new': '🆕', 'classified': '🔍', 'under_action': '⚡', 'resolved': '✅' }[c.status] || '📋';

      reply += `${index + 1}. ${statusEmoji} **${c.description.substring(0, 40)}...**\n`;
      reply += `   📊 Status: ${c.status.toUpperCase()}\n`;
      reply += `   🏷️ Priority: ${c.priority}\n`;
      reply += `   ⏰ Submitted: ${timeAgo}\n\n`;
    });

    res.json({ reply });

  } catch (err) {
    console.error("Bot status check failed:", err);
    res.json({ reply: "Sorry, I'm having trouble accessing your data right now." });
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
