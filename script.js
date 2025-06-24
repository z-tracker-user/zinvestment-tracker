import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDbJphPzvS5nVT2Li_s2MS-hAhztnPdZSs",
  authDomain: "zinvestment-tracker.firebaseapp.com",
  projectId: "zinvestment-tracker",
  storageBucket: "zinvestment-tracker.firebasestorage.app",
  messagingSenderId: "281888732344",
  appId: "1:281888732344:web:b67fc42b977d4d15da704d",
  measurementId: "G-X44KR3M36Q"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Handle Sign Up
document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      document.getElementById("status-message").innerText = "Account created! Welcome.";
    })
    .catch((error) => {
      document.getElementById("status-message").innerText = "Error: " + error.message;
    });
});

// Handle Login
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      document.getElementById("status-message").innerText = "Logged in successfully!";
      loadUserPurchases(auth.currentUser.uid);
    })
    .catch((error) => {
      document.getElementById("status-message").innerText = "Error: " + error.message;
    });
});

// Handle Sign Out
document.getElementById("signout-btn")?.addEventListener("click", () => {
  signOut(auth).then(() => {
    document.getElementById("status-message").innerText = "Logged out successfully.";
    document.getElementById("stocks").innerHTML = "";
  });
});

// Simulate Buy with user input and live price
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

  // Fetch live price from Twelve Data
  try {
    const response = await fetch(`https://api.twelvedata.com/price?symbol=${stockSymbol}&apikey=YOUR_API_KEY_HERE`);
    const priceData = await response.json();

    if (!priceData.price) {
      alert("Could not fetch live price. Please try another stock symbol.");
      return;
    }

    const pricePerShare = parseFloat(priceData.price);
    const totalCost = pricePerShare * stockShares;

    const stockData = {
      userId: user.uid,
      stock: stockSymbol,
      shares: stockShares,
      price: pricePerShare,
      timestamp: new Date()
    };

    const stockList = document.getElementById("stocks");
    const stock = document.createElement("p");
    stock.textContent = `You bought ${stockShares} shares of ${stockSymbol} at $${pricePerShare.toFixed(2)} each, totaling $${totalCost.toFixed(2)}`;
    stockList.appendChild(stock);

    await addDoc(collection(db, "purchases"), stockData);
    console.log("Purchase saved to Firestore");

    document.getElementById("stock-symbol").value = "";
    document.getElementById("stock-shares").value = "";

  } catch (error) {
    console.error("Error fetching price or saving data:", error);
    alert("An error occurred. Please try again.");
  }
};

// Load purchases after login
async function loadUserPurchases(userId) {
  const stockList = document.getElementById("stocks");
  stockList.innerHTML = "";

  try {
    const purchasesRef = collection(db, "purchases");
    const querySnapshot = await getDocs(purchasesRef);

    let userFoundPurchases = false;

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      if (data.userId === userId) {
        userFoundPurchases = true;

        let dateDisplay;
        try {
          dateDisplay = data.timestamp?.toDate
            ? data.timestamp.toDate().toLocaleString()
            : new Date(data.timestamp).toLocaleString();
        } catch (e) {
          dateDisplay = "unknown time";
        }

        const stock = document.createElement("p");
        stock.textContent = `${data.shares} shares of ${data.stock} at $${data.price} on ${dateDisplay}`;
        stockList.appendChild(stock);
      }
    });

    if (!userFoundPurchases) {
      stockList.innerHTML = "<p>No purchases found for this user.</p>";
    }
  } catch (error) {
    console.error("Error loading purchases:", error);
    stockList.innerHTML = "<p>Failed to load purchase history.</p>";
  }
}

