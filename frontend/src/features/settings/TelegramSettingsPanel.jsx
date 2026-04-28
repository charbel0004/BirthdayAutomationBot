export default function TelegramSettingsPanel({ settings, setSettings, onSave }) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Telegram Control</h2>
          <p>Bot token and message template remain in the JSON configuration file. Chat ID can still be updated here.</p>
        </div>
      </div>
      <form onSubmit={onSave} className="grid-form">
        <label>
          Destination chat ID
          <input
            value={settings.defaultChatId}
            onChange={(event) => setSettings({ ...settings, defaultChatId: event.target.value })}
            placeholder="-1001234567890"
          />
        </label>
        <div className="settings-note">
          <span>Bot token configured</span>
          <strong>{settings.hasBotToken ? 'Yes' : 'No'}</strong>
        </div>
        <button type="submit">Save Telegram Settings</button>
      </form>
    </section>
  );
}
