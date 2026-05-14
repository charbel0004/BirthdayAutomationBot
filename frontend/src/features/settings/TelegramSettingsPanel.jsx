export default function TelegramSettingsPanel({ settings, setSettings, onSave }) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Telegram Control</h2>
          <p>Bot token and message template remain in the JSON configuration file. Set separate Telegram group chat IDs for members/admins and new recruits here.</p>
        </div>
      </div>
      <form onSubmit={onSave} className="grid-form">
        <label>
          Members and admins group chat ID
          <input
            value={settings.membersGroupChatId}
            onChange={(event) => setSettings({ ...settings, membersGroupChatId: event.target.value })}
            placeholder="-1001234567890"
          />
        </label>
        <label>
          New recruits group chat ID
          <input
            value={settings.newRecruitsGroupChatId}
            onChange={(event) => setSettings({ ...settings, newRecruitsGroupChatId: event.target.value })}
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
