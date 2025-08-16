const socket = io();

// ----- Population Group Chat -----
const populationChat = document.getElementById('population-chat');
const populationForm = document.getElementById('population-form');
const populationInput = document.getElementById('population-input');
const typingIndicator = document.getElementById('typing-indicator');

populationForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (populationInput.value.trim()) {
    socket.emit('population message', populationInput.value.trim());
    populationInput.value = '';
    socket.emit('stop typing');
  }
});

populationInput.addEventListener('input', () => {
  socket.emit('typing');
});
populationInput.addEventListener('blur', () => {
  socket.emit('stop typing');
});

socket.on('population message', ({ user, msg, ts }) => {
  const div = document.createElement('div');
  div.className = 'message';
  div.textContent = `${user}: ${msg} (${new Date(ts).toLocaleTimeString()})`;
  populationChat.appendChild(div);
  populationChat.scrollTop = populationChat.scrollHeight;
});

socket.on('typing', (user) => {
  typingIndicator.textContent = `${user} is typing...`;
});
socket.on('stop typing', () => {
  typingIndicator.textContent = '';
});

// ----- Babies (contacts) management -----
const babiesList = document.getElementById('babies-list');
const addBabyForm = document.getElementById('add-baby-form');
const babyInput = document.getElementById('baby-username');
const babyMessage = document.getElementById('baby-message');

addBabyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const babyUser = babyInput.value.trim();
  if (!babyUser) return;
  const res = await fetch('/add-baby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baby: babyUser }),
  });
  const data = await res.text();
  babyMessage.textContent = data;
  if (res.ok) {
    babyInput.value = '';
    loadBabies();
  }
});

async function loadBabies() {
  const res = await fetch('/babies');
  const babies = await res.json();
  babiesList.innerHTML = '';
  babies.forEach((baby) => {
    const li = document.createElement('li');
    li.textContent = baby;
    li.style.cursor = 'pointer';

    // Add "remove" button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑️';
    removeBtn.title = 'Remove';
    removeBtn.style.marginLeft = '10px';
    removeBtn.style.background = 'none';
    removeBtn.style.border = 'none';
    removeBtn.style.color = '#fb5970';
    removeBtn.style.cursor = 'pointer';
    removeBtn.onclick = async (event) => {
      event.stopPropagation();
      if (!confirm(`Remove "${baby}" from your babies?`)) return;
      const response = await fetch('/remove-baby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baby }),
      });
      const result = await response.text();
      babyMessage.textContent = result;
      loadBabies();
    };

    li.appendChild(removeBtn);
    li.addEventListener('click', () => startPrivateChat(baby, li));
    babiesList.appendChild(li);
  });
}
loadBabies();

// ----- Private Chat -----
const privateChatSection = document.getElementById('private-chat-section');
const activeBaby = document.getElementById('active-baby');
const privateChat = document.getElementById('private-chat');
const privateForm = document.getElementById('private-form');
const privateInput = document.getElementById('private-input');
let currentRecipient = null;

function startPrivateChat(baby, li) {
  currentRecipient = baby;
  privateChatSection.style.display = 'block';
  activeBaby.textContent = baby;
  fetch('/private-history/' + encodeURIComponent(baby))
    .then((res) => res.json())
    .then((history) => {
      privateChat.innerHTML = '';
      history.forEach(({ sender, msg, ts }) => {
        const div = document.createElement('div');
        div.className = 'message';
        div.textContent = `${sender}: ${msg} (${new Date(ts).toLocaleTimeString()})`;
        privateChat.appendChild(div);
      });
      privateChat.scrollTop = privateChat.scrollHeight;
    });

  // Highlight active baby
  Array.from(babiesList.children).forEach((n) => n.classList.remove('active-baby'));
  if (li) li.classList.add('active-baby');
  
  // Show clear private chat button when private chat is opened
  toggleClearPrivateBtn(true);
}

privateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (privateInput.value.trim() && currentRecipient) {
    socket.emit('private message', { to: currentRecipient, msg: privateInput.value.trim() });
    privateInput.value = '';
  }
});

socket.on('private message', ({ from, to, msg, ts }) => {
  if (from === currentRecipient || to === currentRecipient) {
    const div = document.createElement('div');
    div.className = 'message';
    div.textContent = `${from}: ${msg} (${new Date(ts).toLocaleTimeString()})`;
    privateChat.appendChild(div);
    privateChat.scrollTop = privateChat.scrollHeight;
  }
});

// ----- Clear Chat History Functions -----
const clearPopulationBtn = document.getElementById('clear-population-chat');
const clearPrivateBtn = document.getElementById('clear-private-chat');

// Show or hide clear private chat button
function toggleClearPrivateBtn(show) {
  if (clearPrivateBtn) clearPrivateBtn.hidden = !show;
}

// Clear population chat history
clearPopulationBtn?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete your population chat history?')) return;
  const res = await fetch('/delete-population-history', { method: 'POST' });
  const text = await res.text();
  alert(text);
  if (res.ok) {
    populationChat.innerHTML = '';
  }
});

// Clear private chat history
clearPrivateBtn?.addEventListener('click', async () => {
  if (!currentRecipient) return;
  if (!confirm(`Are you sure you want to delete private chat history with ${currentRecipient}?`)) return;
  const res = await fetch(`/delete-private-history/${encodeURIComponent(currentRecipient)}`, { method: 'POST' });
  const text = await res.text();
  alert(text);
  if (res.ok) {
    privateChat.innerHTML = '';
  }
});

// ----- Load population chat history on page load -----
window.onload = async () => {
  const res = await fetch('/population-history');
  const messages = await res.json();
  messages.forEach(({ user, msg, ts }) => {
    const div = document.createElement('div');
    div.className = 'message';
    div.textContent = `${user}: ${msg} (${new Date(ts).toLocaleTimeString()})`;
    populationChat.appendChild(div);
  });
  populationChat.scrollTop = populationChat.scrollHeight;
};
