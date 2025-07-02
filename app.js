import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbJphPzvS5nVT2Li_s2MS-hAhztnPdZSs",
  authDomain: "zinvestment-tracker.firebaseapp.com",
  projectId: "zinvestment-tracker",
  storageBucket: "zinvestment-tracker.appspot.com",
  messagingSenderId: "281888732344",
  appId: "1:281888732344:web:b67fc42b977d4d15da704d",
  measurementId: "G-X44KR3M36Q"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variable for Chart.js chart instance
let portfolioChart = null;

// Fetch live stock price function
async function fetchStockPrice(symbol) {
  const apiKey = "e234837e077b414fbddbf543f40d4add";
  const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.price) {
      return parseFloat(data.price);
    } else {
      throw new Error(data.message || "Invalid stock symbol");
    }
  } catch (error) {
    console.error("Error fetching stock price:", error);
    throw error;
  }
}

// Handle Auth Changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("logout-button").style.display = "inline-block";
    loadUserPurchases(user.uid);

    document.getElementById("portfolio").style.display = "block";
    document.getElementById("dashboard").style.display = "block";
    document.getElementById("auth-forms").style.display = "none";
  } else {
    document.getElementById("logout-button").style.display = "none";
    document.getElementById("stocks-table-body").innerHTML = "";
    document.getElementById("total-value").innerText = "0.00";

    // Hide portfolio & dashboard, show auth forms
    document.getElementById("portfolio").style.display = "none";
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("auth-forms").style.display = "block";

    // Destroy existing chart if any
    if (portfolioChart) {
      portfolioChart.destroy();
      portfolioChart = null;
    }
  }
});

// Sign Up
document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      document.getElementById("status-message").innerText = "Account created! Welcome.";
      document.getElementById("signup-form").reset();
    })
    .catch((error) => {
      document.getElementById("status-message").innerText = "Error: " + error.message;
    });
});

// Login
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      document.getElementById("status-message").innerText = "Logged in successfully.";
      document.getElementById("login-form").reset();
    })
    .catch((error) => {
      document.getElementById("status-message").innerText = "Error: " + error.message;
    });
});

// Logout
document.getElementById("logout-button").addEventListener("click", () => {
  signOut(auth).then(() => {
    document.getElementById("status-message").innerText = "Logged out.";
  });
});

// Simulate Buy with live stock price
window.simulateBuy = async function () {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in to simulate a buy.");
    return;
  }

  const stockSymbol = document.getElementById("stock-symbol").value.toUpperCase();
  const stockShares = parseInt(document.getElementById("stock-shares").value);
  if (!stockSymbol || isNaN(stockShares) || stockShares < 1) {
    alert("Please enter a valid stock symbol and number of shares.");
    return;
  }

  let pricePerShare;
  try {
    pricePerShare = await fetchStockPrice(stockSymbol);
  } catch (error) {
    alert("Failed to fetch stock price. Check the stock symbol.");
    return;
  }

  const stockData = {
    userId: user.uid,
    stock: stockSymbol,
    shares: stockShares,
    price: pricePerShare,
    timestamp: new Date()
  };

  try {
    await addDoc(collection(db, "purchases"), stockData);
    document.getElementById("status-message").innerText = `You bought ${stockShares} shares of ${stockSymbol} at $${pricePerShare.toFixed(2)}`;
    loadUserPurchases(user.uid);
  } catch (error) {
    document.getElementById("status-message").innerText = "Error saving purchase.";
  }

  document.getElementById("stock-symbol").value = "";
  document.getElementById("stock-shares").value = "";
};

// Load Purchases with Sorting, Formatting, and Dashboard update
async function loadUserPurchases(uid) {
  const q = query(collection(db, "purchases"), where("userId", "==", uid));
  const querySnapshot = await getDocs(q);

  const purchases = [];
  querySnapshot.forEach((doc) => {
    purchases.push(doc.data());
  });

  purchases.sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
    return timeB - timeA;
  });

  const tbody = document.getElementById("stocks-table-body");
  tbody.innerHTML = "";
  let totalValue = 0;

  // Aggregate data for dashboard
  const stockTotals = {};

  purchases.forEach((purchase) => {
    const total = purchase.price * purchase.shares;
    totalValue += total;

    // Aggregate per stock symbol
    if (!stockTotals[purchase.stock]) stockTotals[purchase.stock] = 0;
    stockTotals[purchase.stock] += total;

    const dateObj = purchase.timestamp?.toDate ? purchase.timestamp.toDate() : new Date(purchase.timestamp);
    const dateFormatted = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${
      dateObj.getDate().toString().padStart(2, '0')}/${
      dateObj.getFullYear()} ${
      dateObj.getHours().toString().padStart(2, '0')}:${
      dateObj.getMinutes().toString().padStart(2, '0')}`;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${purchase.stock}</td>
      <td>${purchase.shares}</td>
      <td>$${purchase.price.toFixed(2)}</td>
      <td>$${total.toFixed(2)}</td>
      <td>${dateFormatted}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("total-value").innerText = totalValue.toFixed(2);

  // Update dashboard display
  document.getElementById("dashboard-total-value").innerText = `$${totalValue.toFixed(2)}`;
  const largestStock = Object.entries(stockTotals).sort((a,b) => b[1] - a[1])[0];
  document.getElementById("dashboard-largest-holding").innerText = largestStock ? `${largestStock[0]} ($${largestStock[1].toFixed(2)})` : 'N/A';
  document.getElementById("dashboard-stock-count").innerText = Object.keys(stockTotals).length;

  // Draw pie chart
  drawPortfolioChart(stockTotals);
}

// Draw Portfolio Pie Chart using Chart.js
function drawPortfolioChart(stockTotals) {
  const ctx = document.getElementById('portfolio-chart').getContext('2d');

  const labels = Object.keys(stockTotals);
  const data = Object.values(stockTotals);

  if (portfolioChart) {
    portfolioChart.destroy();
  }

  portfolioChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Portfolio Distribution',
        data: data,
        backgroundColor: labels.map(() => getRandomColor()),
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
        }
      }
    }
  });
}

// Generate random pastel color for chart slices
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 70%)`;
}
