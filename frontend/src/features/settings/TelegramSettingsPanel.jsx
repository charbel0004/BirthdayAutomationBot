export default function TelegramSettingsPanel({ settings, setSettings, onSave }) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Telegram Control</h2>
          <p>Telegram delivery settings are stored in MongoDB. Set the single Telegram chat ID that should receive birthday messages.</p>
        </div>
      </div>
      <form onSubmit={onSave} className="grid-form">
        <label>
          Bot token
          <input
            type="password"
            value={settings.botToken}
            onChange={(event) => setSettings({ ...settings, botToken: event.target.value })}
            placeholder="1234567890:AA..."
            autoComplete="off"
          />
        </label>
        <label>
          Birthday chat ID
          <input
            value={settings.birthdayChatId}
            onChange={(event) => setSettings({ ...settings, birthdayChatId: event.target.value })}
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
