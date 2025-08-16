const socket = io();
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const userInput = document.getElementById('user');
const input = document.getElementById('input');

// Fetch chat history
fetch('/history')
  .then(res => res.json())
  .then(rows => rows.forEach(({user, msg, ts}) => appendMessage(user, msg, ts)));

form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (input.value && userInput.value) {
    socket.emit('chat message', { user: userInput.value, msg: input.value });
    input.value = '';
  }
});

socket.on('chat message', function({ user, msg, ts }) {
  appendMessage(user, msg, ts);
});

function appendMessage(user, msg, ts) {
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<span class="user">${user}</span>: <span>${msg}</span> <span class="ts">${new Date(ts).toLocaleTimeString()}</span>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
