<div class="typing">
  <span></span>
  <span></span>
  <span></span>
</div>

<style>
  .typing {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }
  .typing span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
  }
  .typing span:nth-child(1) { animation: bounce 0.6s ease-in-out infinite; }
  .typing span:nth-child(2) { animation: bounce 0.6s ease-in-out 0.15s infinite; }
  .typing span:nth-child(3) { animation: bounce 0.6s ease-in-out 0.3s infinite; }

  @keyframes bounce {
    0%, 100% { opacity: 0.3; transform: translateY(0); }
    50% { opacity: 1; transform: translateY(-3px); }
  }
</style>
