// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBo8Dbn_DesbAdTj4i1m-tikFZZdi7TBR0",
  authDomain: "pb-bros.firebaseapp.com",
  projectId: "pb-bros",
  storageBucket: "pb-bros.firebasestorage.app",
  messagingSenderId: "31131114410",
  appId: "1:31131114410:web:e42ee2956e0c804b5f29d3",
  measurementId: "G-T62ZTPRXMD"
};

// Initialize Firebase using Compat SDK
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const swipeContainer = document.getElementById('main-swipe-container');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const existingUsersContainer = document.getElementById('existing-users-container');
const existingUsersList = document.getElementById('existing-users-list');
const currentUserName = document.getElementById('current-user-name');
const logoutBtn = document.getElementById('logout-btn');
const btnEatPb = document.getElementById('btn-eat-pb');
const btnSayPb = document.getElementById('btn-say-pb');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardEmpty = document.getElementById('leaderboard-empty');
const connectionStatus = document.getElementById('connection-status');
const disclaimerModal = document.getElementById('disclaimer-modal');
const btnAgree = document.getElementById('btn-agree');

// Totals Pane Elements
const currentMonthDisplay = document.getElementById('current-month-display');
const totalAteCount = document.getElementById('total-ate-count');
const totalSaidCount = document.getElementById('total-said-count');

// Shop Pane Elements
const shopUsername = document.getElementById('shop-username');
const shopBalanceDisplay = document.getElementById('shop-balance-display');


// --- State ---
let currentUser = null;
let playersData = [];

function getCurrentMonthString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`; // e.g. "2026-09"
}

function init() {
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.style.color = 'var(--text-secondary)';

    // Set nice month name in UI
    currentMonthDisplay.textContent = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    // Check local storage to see if they are already logged in
    const savedUser = localStorage.getItem('pb-bros-user');
    if (savedUser) {
        login(savedUser);
    }

    // Connect to Firebase and listen to leaderboard updates
    db.collection('users').onSnapshot((snapshot) => {
        playersData = [];
        snapshot.forEach((doc) => {
            playersData.push({ name: doc.id, ...doc.data() });
        });
        
        connectionStatus.textContent = 'Live 🟢';
        connectionStatus.style.color = 'var(--success-color)';
        
        renderLeaderboard();
        renderUserSelector();
        renderShop();
    }, (error) => {
        console.error("Error fetching data:", error);
        connectionStatus.textContent = 'Disconnected 🔴 (Check Database Rules)';
        connectionStatus.style.color = 'var(--warning-color)';
    });

    // Listen to Monthly Totals
    const currentMonth = getCurrentMonthString();
    db.collection('monthly_totals').doc(currentMonth).onSnapshot((docSnap) => {
        if (docSnap.exists) {
            const data = docSnap.data();
            totalAteCount.textContent = data.totalAte || 0;
            totalSaidCount.textContent = data.totalSaid || 0;
        } else {
            totalAteCount.textContent = 0;
            totalSaidCount.textContent = 0;
        }
    });
}

// --- Auth ---
function showDisclaimer() {
    return new Promise((resolve) => {
        disclaimerModal.classList.remove('hidden');
        btnAgree.onclick = () => {
            disclaimerModal.classList.add('hidden');
            resolve();
        };
    });
}

async function login(username) {
    currentUser = username.trim();
    if (!currentUser) return;
    
    // Check if user exists in the cloud DB, if not create them
    try {
        const userRef = db.collection('users').doc(currentUser);
        const userSnap = await userRef.get();
        
        if (!userSnap.exists) {
            await showDisclaimer();
            await userRef.set({ ate: 0, said: 0, score: 0, balance: 0 });
        }

        localStorage.setItem('pb-bros-user', currentUser);
        currentUserName.textContent = currentUser;
        
        renderShop();
        
        loginSection.classList.add('hidden');
        swipeContainer.classList.remove('hidden');
    } catch (e) {
        console.error("Login Error:", e);
        alert("Could not log in! Make sure your Firestore Database is created and set to Test Mode.");
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('pb-bros-user');
    
    loginSection.classList.remove('hidden');
    swipeContainer.classList.add('hidden');
}

// --- Tracking ---
async function trackEvent(type) {
    if (!currentUser) return;

    // Add satisfying click effect
    const btn = type === 'eat' ? btnEatPb : btnSayPb;
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 150);

    const userRef = db.collection('users').doc(currentUser);
    const totalsRef = db.collection('monthly_totals').doc(getCurrentMonthString());
    
    try {
        if (type === 'eat') {
            await userRef.update({
                ate: firebase.firestore.FieldValue.increment(1),
                score: firebase.firestore.FieldValue.increment(1),
                balance: firebase.firestore.FieldValue.increment(1)
            });
            await totalsRef.set({
                totalAte: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });
        } else if (type === 'say') {
            createPBRain(); // Trigger the rain!
            await userRef.update({
                said: firebase.firestore.FieldValue.increment(1),
                score: firebase.firestore.FieldValue.increment(5),
                balance: firebase.firestore.FieldValue.increment(5)
            });
            await totalsRef.set({
                totalSaid: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });
        }
    } catch (e) {
        console.error("Tracking Error:", e);
        alert("Failed to track event! Are database rules open?");
    }
}

// --- Leaderboard ---
function renderLeaderboard() {
    leaderboardList.innerHTML = '';
    
    // Filter out "test user" from the rankings
    const rankedPlayers = playersData.filter(p => p.name.toLowerCase() !== 'test user');

    // Sort players by score descending
    rankedPlayers.sort((a, b) => b.score - a.score);
    
    if (rankedPlayers.length === 0) {
        leaderboardEmpty.classList.remove('hidden');
    } else {
        leaderboardEmpty.classList.add('hidden');
        
        rankedPlayers.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            
            // Highlight top 3
            let rankClass = '';
            if (index === 0) rankClass = 'rank-1';
            else if (index === 1) rankClass = 'rank-2';
            else if (index === 2) rankClass = 'rank-3';

            li.innerHTML = `
                <div class="rank ${rankClass}">#${index + 1}</div>
                <div class="player-name">${escapeHTML(player.name)}</div>
                <div class="player-stats">
                    <span>🥜 ${player.ate}</span>
                    <span>🗣️ ${player.said}</span>
                </div>
                <div class="player-score">${player.score} pts</div>
            `;
            leaderboardList.appendChild(li);
        });
    }
}

function renderShop() {
    if (!currentUser) return;
    
    const myData = playersData.find(p => p.name === currentUser);
    shopUsername.textContent = currentUser;
    
    if (myData) {
        const balance = myData.balance !== undefined ? myData.balance : (myData.score || 0);
        shopBalanceDisplay.textContent = balance;
    } else {
        shopBalanceDisplay.textContent = 0;
    }
}

async function buyItem(cost, itemName) {
    if (!currentUser) return;

    const myData = playersData.find(p => p.name === currentUser);
    if (!myData) return;

    const currentBalance = myData.balance !== undefined ? myData.balance : (myData.score || 0);

    if (currentBalance < cost) {
        alert(`Not enough points, Bro! You need ${cost} points to buy ${itemName}. Eat more PB!`);
        return;
    }
    
    const confirmPurchase = window.confirm(`Are you sure you want to buy ${itemName} for ${cost} points?`);
    if (!confirmPurchase) return;

    try {
        const userRef = db.collection('users').doc(currentUser);
        await userRef.update({
            balance: currentBalance - cost
        });
        
        // Trigger Email in Backend (Firebase Extension)
        await db.collection('mail').add({
            to: 'chandlerbry1@gmail.com',
            message: {
                subject: 'PB BROS Purchase',
                text: `${currentUser} just bought: ${itemName}!`
            }
        });
        
        // Fun animation for buying
        createPBRain();
        alert(`Successfully bought ${itemName}!`);
    } catch (e) {
        console.error("Purchase Error:", e);
        alert("Failed to purchase item!");
    }
}

// --- Login User Selector ---
function renderUserSelector() {
    if (playersData.length === 0) {
        existingUsersContainer.classList.add('hidden');
        return;
    }
    
    existingUsersContainer.classList.remove('hidden');
    existingUsersList.innerHTML = '';
    
    playersData.forEach(player => {
        const btn = document.createElement('button');
        btn.className = 'user-pill';
        btn.textContent = player.name;
        btn.type = 'button';
        btn.onclick = () => login(player.name);
        existingUsersList.appendChild(btn);
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Effects ---
function createPBRain() {
    const items = ['emoji-🍯', 'emoji-🥜', 'img-favicon.png'];
    for (let i = 0; i < 35; i++) {
        const itemType = items[Math.floor(Math.random() * items.length)];
        let jar;
        
        if (itemType.startsWith('img-')) {
            jar = document.createElement('img');
            jar.src = itemType.replace('img-', '');
            // Give the image a random size similar to the emojis
            const size = Math.random() * 25 + 30; // 30px to 55px
            jar.style.width = size + 'px';
            jar.style.height = size + 'px';
            jar.style.objectFit = 'contain';
        } else {
            jar = document.createElement('div');
            jar.textContent = itemType.replace('emoji-', '');
            jar.style.fontSize = (Math.random() * 1.5 + 1.5) + 'rem';
        }
        
        jar.className = 'pb-jar';
        
        // Randomize starting position and fall speed
        jar.style.left = Math.random() * 100 + 'vw';
        jar.style.animationDuration = (Math.random() * 2 + 1.5) + 's'; // 1.5s to 3.5s
        
        document.body.appendChild(jar);
        
        // Cleanup element after animation finishes
        setTimeout(() => {
            jar.remove();
        }, 4000); 
    }
}

// --- Event Listeners ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login(usernameInput.value);
    usernameInput.value = '';
});

logoutBtn.addEventListener('click', logout);
btnEatPb.addEventListener('click', () => trackEvent('eat'));
btnSayPb.addEventListener('click', () => trackEvent('say'));

// Start app
init();
