/* ================= CONFIGURATION ================= */

// 👇 PASTE YOUR RENDER URL HERE (No trailing slash)
const API_BASE_URL = "https://nagrik-raskshak.onrender.com";

// Use this one if you are testing locally on your laptop:
// const API_BASE_URL = "http://localhost:3000"; 


/* ================= USER STATE ================= */
const user = JSON.parse(localStorage.getItem("user"));

// ===== HEADER USER STATE =====
if (user) {
  document.getElementById("loggedUser").classList.remove("hidden");
  document.getElementById("loggedUserName").innerText = user.name;
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("signupBtn").style.display = "none";
  document.getElementById("logoutBtn").classList.remove("hidden");
  
  // Prefill Name
  document.getElementById("name").value = user.name;
} else {
  window.location.href = "auth.html?mode=login";
}

function logout() {
  localStorage.clear();
  window.location.href = "auth.html?mode=login";
}

// ===== IMAGE INPUT UI =====
const imageInput = document.getElementById("dropzone-file");
const uploadText = document.getElementById("uploadText");
const uploadedText = document.getElementById("uploadedText");

imageInput.addEventListener("change", () => {
  if (imageInput.files.length > 0) {
    uploadText.classList.add("hidden");
    uploadedText.classList.remove("hidden");
  } else {
    uploadedText.classList.add("hidden");
    uploadText.classList.remove("hidden");
  }
});

// ===== LOCATION DATA =====
const areaCoords = {
  Golghar: [26.7606, 83.3732],
  Rustampur: [26.7518, 83.3645],
  Gorakhnath: [26.7794, 83.3729],
  Mohaddipur: [26.7399, 83.3811],
  Chargawan: [26.8051, 83.3653],
  "Medical College": [26.759, 83.3952],
  University: [26.7749, 83.4065],
  "Railway Station": [26.7489, 83.381],
};

document.getElementById("areaSelect").addEventListener("change", () => {
  const areaSelect = document.getElementById("areaSelect");
  const area = areaSelect.value;
  if (area && areaCoords[area]) {
    document.getElementById("lat").value = areaCoords[area][0];
    document.getElementById("lng").value = areaCoords[area][1];
  } else {
    navigator.geolocation.getCurrentPosition((pos) => {
      document.getElementById("lat").value = pos.coords.latitude;
      document.getElementById("lng").value = pos.coords.longitude;
    });
  }
});

// ===== SUBMIT COMPLAINT =====
document.getElementById("complaintForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("email").value.trim();
  const complaint = document.getElementById("message").value.trim();

  if (!name || !mobile || mobile.length != 10 || !complaint) {
    alert("⚠️ Fill Name, Mobile and Complaint");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("mobile", mobile);
  formData.append("description", complaint);
  formData.append("lat", document.getElementById("lat").value);
  formData.append("lng", document.getElementById("lng").value);
  formData.append("userId", user.id);
  formData.append("userName", user.name);

  if (imageInput.files.length > 0) {
    formData.append("image", imageInput.files[0]);
  }

  try {
    // UPDATED: Uses API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/submit-complaint`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      const modal = document.getElementById("successModal");
      modal.classList.remove("hidden");
      modal.style.display = "flex";

      setTimeout(() => {
        e.target.reset();
        uploadedText.classList.add("hidden");
        uploadText.classList.remove("hidden");
      }, 300);

      // Refresh past complaints
      fetchPastComplaints();
    }
  } catch (err) {
    alert("Server error. Try again later.");
    console.error(err);
  }
});

// ===== CLOSE MODAL =====
function closeSuccessModal() {
  const modal = document.getElementById("successModal");
  modal.classList.add("hidden");
  modal.style.display = "none";
}
window.closeSuccessModal = closeSuccessModal;

// ===== FETCH PAST COMPLAINTS =====
async function fetchPastComplaints() {
  try {
    // UPDATED: Uses API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/my-complaints?userId=${user.id}`);
    
    if (!res.ok) throw new Error("Network error");

    const complaints = await res.json();
    if (!Array.isArray(complaints)) throw new Error("Invalid data from server");

    const container = document.getElementById("pastComplaints");
    container.innerHTML = "";

    if (complaints.length === 0) {
      container.innerHTML = `<p class="text-gray-300 col-span-full text-center">No past complaints found</p>`;
      return;
    }

    complaints.forEach((c) => {
      const createdAt = new Date(c.createdAt);
      const now = new Date();
      const diffHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      const timePassed = days > 0 ? `${days}d ${hours}h ago` : `${diffHours}h ago`;
      
      let lastAction = "Submitted";
      let lastActionTime = "";
      
      if (c.actions && c.actions.length > 0) {
        const last = c.actions[c.actions.length - 1];
        lastAction = last.action;
        lastActionTime = new Date(last.timestamp).toLocaleDateString();
      }

      const card = document.createElement("div");
      card.className = "bg-[#1b1b25] p-4 rounded-2xl border border-white/10 shadow-md mb-4";
      
      // UPDATED: Image Source uses API_BASE_URL
      const imageHTML = c.imagePath
        ? `<img 
            src="${API_BASE_URL}/${c.imagePath}" 
            class="mt-2 w-full h-32 object-cover rounded-lg"
           />`
        : "";

      card.innerHTML = `
        <div class="flex justify-between items-start">
          <h3 class="text-lg font-semibold text-violet-300">
            ${c.description.substring(0, 40)}${c.description.length > 40 ? "..." : ""}
          </h3>
          <span class="status-badge ${c.status}">${c.status}</span>
        </div>
        
        <div class="mt-2 space-y-1">
          <p class="text-gray-400"><b>Status:</b> ${getSimpleStatusText(c.status)}</p>
          <p class="text-gray-400"><b>Submitted:</b> ${createdAt.toLocaleDateString()}</p>
          <p class="text-gray-400"><b>Time passed:</b> ${timePassed}</p>
          <p class="text-gray-400"><b>Last update:</b> ${lastActionTime || createdAt.toLocaleDateString()}</p>
        </div>
        
        ${imageHTML}
        
        <div class="mt-3">
          <p class="text-gray-500 text-sm"><b>Latest update:</b> ${lastAction}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to fetch complaints", err);
    const container = document.getElementById("pastComplaints");
    container.innerHTML = `<p class="text-red-500 col-span-full text-center">Failed to load complaints</p>`;
  }
}

function getSimpleStatusText(status) {
  const statusMap = {
    'new': '⏳ Awaiting Review',
    'classified': '🔍 Under Review',
    'under_action': '⚡ Action In Progress',
    'resolved': '✅ Resolved'
  };
  return statusMap[status] || status;
}

// Initial Fetch
fetchPastComplaints();


// ===== BOT LOGIC =====

async function handleBotMessage(text) {
  const user = JSON.parse(localStorage.getItem("user"));
  
  const statusKeywords = ['status', 'update', 'progress', 'track', 'complaint', 'my complaints', 
                         'pending', 'resolved', 'open', 'closed', 'submitted', 'recent'];
  
  const isAskingAboutComplaints = statusKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
  
  if (isAskingAboutComplaints && user) {
    return await checkComplaintStatus(user.id, text);
  } else if (isAskingAboutComplaints && !user) {
    return {
      reply: "Please log in first to check your complaint status. Click the login button above."
    };
  } else {
    return await fetchRegularBotResponse(text);
  }
}

async function checkComplaintStatus(userId, message) {
  try {
    // UPDATED: Uses API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/bot-check-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message })
    });
    return await res.json();
  } catch (err) {
    console.error("Status check failed:", err);
    return {
      reply: "I'm having trouble accessing the complaint system right now. Please check the 'My Past Complaints' section directly."
    };
  }
}

async function fetchRegularBotResponse(text) {
  try {
    // UPDATED: Uses API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/bot-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    return await res.json();
  } catch (err) {
    console.error("Bot query failed:", err);
    return {
      reply: "I'm having trouble connecting to the help system. Please try again later."
    };
  }
}

async function sendBotMessage() {
  const input = document.getElementById("botInput");
  const messages = document.getElementById("botMessages");

  const text = input.value.trim();
  if (!text) return;

  // User message
  messages.innerHTML += `
    <div class="mb-2 text-right text-violet-300">
      ${text}
    </div>
  `;
  input.value = "";
  messages.scrollTop = messages.scrollHeight;

  // Typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.className = "typing";
  typingDiv.innerHTML = `<span></span><span></span><span></span>`;
  messages.appendChild(typingDiv);
  messages.scrollTop = messages.scrollHeight;

  try {
    const data = await handleBotMessage(text);

    // Remove typing animation
    typingDiv.remove();

    // Typewriter effect
    const botMsg = document.createElement("div");
    botMsg.className = "mb-2 text-gray-300 whitespace-pre-line";
    messages.appendChild(botMsg);

    let i = 0;
    const reply = data.reply;

    const typer = setInterval(() => {
      botMsg.textContent += reply.charAt(i);
      i++;
      messages.scrollTop = messages.scrollHeight;

      if (i >= reply.length) {
        clearInterval(typer);
      }
    }, 20);

  } catch (err) {
    typingDiv.remove();
    messages.innerHTML += `
      <div class="mb-2 text-red-400">
        Something went wrong. Please try again.
      </div>
    `;
  }
}

function toggleBot() {
  const botBox = document.getElementById("botBox");
  const botToggle = document.getElementById("botToggle");

  if (!botBox || !botToggle) return;

  if (!botBox.classList.contains("active")) {
    botBox.classList.add("active");
    botToggle.style.transition = "transform 0.2s ease";
    botToggle.style.transform = "scale(0)";
    setTimeout(() => {
      botToggle.style.display = "none";
    }, 200);
  } else {
    botBox.classList.remove("active");
    botToggle.style.display = "flex";
    botToggle.style.transition = "transform 0.2s ease";
    setTimeout(() => {
      botToggle.style.transform = "scale(1)";
    }, 50);
  }
}

// ===== INJECT STYLES =====
const style = document.createElement('style');
style.textContent = `
  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .status-badge.new { background: #ff9800; color: #000; }
  .status-badge.classified { background: #2196f3; color: white; }
  .status-badge.under_action { background: #9c27b0; color: white; }
  .status-badge.resolved { background: #4caf50; color: white; }
`;
document.head.appendChild(style);
