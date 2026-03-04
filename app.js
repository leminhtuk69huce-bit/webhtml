// BẠN PHẢI THAY THẾ CONFIG NÀY BẰNG CONFIG TRONG PROJECT FIREBASE CỦA BẠN
const firebaseConfig = { 
  apiKey : "AIzaSyDSSzbiSRqgcq8aJRBlfAXAo2NcijMgdw0" , 
  authDomain : "web-chat-d2f81.firebaseapp.com" , 
  databaseURL: "https://web-chat-d2f81-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId : "web-chat-d2f81" , 
  storageBucket : "web-chat-d2f81.firebasestorage.app" , 
  messagingSenderId : "16356873713" , 
  appId : "1:16356873713:web:a53f211e4c80f12c97e050" , 
  measurementId : "G-5VM280GKSE" 
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Biến toàn cục
let currentUser = null;
let currentChatTarget = null;
let currentRoomId = null;

// Tham chiếu DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username-input');
const myNameDisplay = document.getElementById('my-name');
const logoutBtn = document.getElementById('logout-btn');
const userList = document.getElementById('user-list');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatWithName = document.getElementById('chat-with-name');
const chatInputArea = document.getElementById('chat-input-area');

// 1. KIỂM TRA ĐĂNG NHẬP (F5 giữ nguyên tài khoản)
function checkLogin() {
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
        currentUser = savedUser;
        showChatScreen();
        setupPresence();
        loadUsers();
    } else {
        loginScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
    }
}

// 2. XỬ LÝ ĐĂNG NHẬP
loginBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name !== "") {
        currentUser = name;
        localStorage.setItem('chatUser', name); // Lưu vào máy
        showChatScreen();
        setupPresence();
        loadUsers();
    }
});

function showChatScreen() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    myNameDisplay.textContent = currentUser;
}

// 3. TRẠNG THÁI ONLINE/OFFLINE VÀ ĐĂNG XUẤT
function setupPresence() {
    const userRef = db.ref('users/' + currentUser);
    
    // Khi vừa vào, set trạng thái online
    userRef.set({ status: 'online', last_changed: firebase.database.ServerValue.TIMESTAMP });
    
    // Nếu tắt tab đột ngột hoặc rớt mạng -> Tự động đổi thành offline
    userRef.onDisconnect().set({ status: 'offline', last_changed: firebase.database.ServerValue.TIMESTAMP });
}

logoutBtn.addEventListener('click', () => {
    // Chủ động set offline khi đăng xuất
    db.ref('users/' + currentUser).update({ status: 'offline' }).then(() => {
        localStorage.removeItem('chatUser');
        window.location.reload(); // Tải lại trang để về màn hình đăng nhập
    });
});

// 4. HIỂN THỊ DANH SÁCH BẠN BÈ (Chỉ hiện người Online)
function loadUsers() {
    db.ref('users').on('value', (snapshot) => {
        userList.innerHTML = '';
        const users = snapshot.val();
        
        for (let user in users) {
            if (user !== currentUser) { // Không hiển thị chính mình
                const isOnline = users[user].status === 'online';
                
                // CHỈ THÊM VÀO DANH SÁCH NẾU ĐANG ONLINE
                if (isOnline) {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${user}</span>
                        <span class="status-dot online"></span>
                    `;
                    li.addEventListener('click', () => selectUserToChat(user));
                    userList.appendChild(li);
                }
            }
        }
    });
}

// 5. CLICK VÀO NGƯỜI DÙNG ĐỂ CHAT
function selectUserToChat(targetUser) {
    currentChatTarget = targetUser;
    chatWithName.textContent = `Đang chat với: ${targetUser}`;
    chatInputArea.classList.remove('hidden');
    
    // Tạo ID phòng chat duy nhất cho 2 người (sắp xếp theo alphabet)
    // VD: "Anh" và "Binh" sẽ luôn chung room "Anh_Binh"
    const participants = [currentUser, targetUser].sort();
    currentRoomId = `${participants[0]}_${participants[1]}`;
    
    loadMessages();
}

// 6. LƯU & TẢI TIN NHẮN
function loadMessages() {
    chatMessages.innerHTML = '';
    db.ref('messages/' + currentRoomId).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        const div = document.createElement('div');
        div.classList.add('message');
        div.classList.add(msg.sender === currentUser ? 'sent' : 'received');
        div.textContent = msg.text;
        chatMessages.appendChild(div);
        
        // Tự động cuộn xuống dưới cùng
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text !== "" && currentRoomId) {
        db.ref('messages/' + currentRoomId).push({
            sender: currentUser,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        messageInput.value = '';
    }
}

// Chạy hàm kiểm tra lúc mới mở web
checkLogin();
