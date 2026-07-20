import { useEffect, useMemo, useState } from 'react';

const categoryLabels = {
  cleaning: 'Cleaning',
  events: 'Events',
  activities: 'Activities',
  'daily-use': 'Daily use',
  other: 'Other'
};

function formatAmount(value) {
  return Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value).toFixed(2));
}

function pluralizeUnit(value, amount) {
  const unit = String(value || '').trim();
  if (!unit || Number(amount) === 1 || unit.endsWith('s')) return unit;
  if (/(s|x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

function describeQuantity(value, item) {
  const amount = Number(value || 0);
  const packageSize = Number(item.unitsPerPackage);
  const unit = item.unit || 'units';

  if (!item.packageUnit || !Number.isFinite(packageSize) || packageSize <= 0) {
    return `${formatAmount(amount)} ${unit}`;
  }

  const packages = Math.floor(amount / packageSize);
  const loose = Number((amount - packages * packageSize).toFixed(6));
  const parts = [];
  if (packages) parts.push(`${formatAmount(packages)} ${pluralizeUnit(item.packageUnit, packages)}`);
  if (loose || !packages) parts.push(`${formatAmount(loose)} ${unit}`);
  return `${parts.join(' + ')} · ${formatAmount(amount)} ${unit} total`;
}

function InventoryRow({ item, onSave, onDelete }) {
  const [draft, setDraft] = useState(item);

  useEffect(() => setDraft(item), [item]);

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const adjustQuantity = (change) => {
    const nextQuantity = Math.max(0, Number(item.quantity) + change);
    onSave(item.id, { quantity: nextQuantity });
  };
  const packageSize = Number(item.unitsPerPackage);
  const hasPackages = Boolean(item.packageUnit && Number.isFinite(packageSize) && packageSize > 0);

  return (
    <tr className={item.isLowStock ? 'logistics-low-row' : ''}>
      <td>
        <input
          aria-label={`Name for ${item.name}`}
          value={draft.name}
          onChange={(event) => update('name', event.target.value)}
        />
      </td>
      <td>
        <select
          aria-label={`Category for ${item.name}`}
          value={draft.category}
          onChange={(event) => update('category', event.target.value)}
        >
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </td>
      <td>
        <div className="quantity-control">
          <button type="button" className="secondary quantity-button" onClick={() => adjustQuantity(-1)} aria-label={`Remove one ${item.unit || 'unit'} of ${item.name}`}>−</button>
          <input
            type="number"
            min="0"
            step="any"
            aria-label={`Quantity for ${item.name}`}
            value={draft.quantity}
            onChange={(event) => update('quantity', event.target.value)}
          />
          <button type="button" className="secondary quantity-button" onClick={() => adjustQuantity(1)} aria-label={`Add one ${item.unit || 'unit'} of ${item.name}`}>+</button>
        </div>
        <small className="quantity-equivalent">{describeQuantity(draft.quantity, draft)}</small>
      </td>
      <td>
        <input
          aria-label={`Unit for ${item.name}`}
          value={draft.unit}
          onChange={(event) => update('unit', event.target.value)}
        />
      </td>
      <td>
        <div className="package-editor">
          <input
            aria-label={`Package name for ${item.name}`}
            value={draft.packageUnit || ''}
            onChange={(event) => update('packageUnit', event.target.value)}
            placeholder="box / bag"
          />
          <input
            type="number"
            min="0.01"
            step="any"
            aria-label={`Units per package for ${item.name}`}
            value={draft.unitsPerPackage || ''}
            onChange={(event) => update('unitsPerPackage', event.target.value)}
            placeholder="per package"
          />
        </div>
        {hasPackages ? (
          <div className="package-quick-actions">
            <button type="button" className="secondary" onClick={() => adjustQuantity(-packageSize)}>− {item.packageUnit}</button>
            <button type="button" className="secondary" onClick={() => adjustQuantity(packageSize)}>+ {item.packageUnit}</button>
          </div>
        ) : null}
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="any"
          aria-label={`Reorder point for ${item.name}`}
          value={draft.reorderPoint}
          onChange={(event) => update('reorderPoint', event.target.value)}
        />
      </td>
      <td>
        <input
          aria-label={`Storage location for ${item.name}`}
          value={draft.location}
          onChange={(event) => update('location', event.target.value)}
        />
      </td>
      <td>
        <span className={`status-chip ${item.isLowStock ? 'off' : 'on'}`}>
          {item.isLowStock ? 'Reorder' : 'In stock'}
        </span>
      </td>
      <td>
        <div className="actions logistics-actions">
          <button type="button" onClick={() => onSave(item.id, draft)}>Save</button>
          <button type="button" className="secondary" onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

export default function LogisticsPage({
  items,
  draft,
  setDraft,
  onCreate,
  onSave,
  onDelete,
  onSendReminder
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const lowStockItems = useMemo(() => items.filter((item) => item.isLowStock), [items]);
  const visibleItems = categoryFilter === 'all'
    ? items
    : items.filter((item) => item.category === categoryFilter);
  const packageSize = Number(draft.unitsPerPackage);
  const packageDetailsValid = draft.usesPackages && Number.isFinite(packageSize) && packageSize > 0;

  const handleCreate = (event) => {
    event.preventDefault();
    onCreate({
      ...draft,
      quantity: draft.usesPackages
        ? Number(draft.packageQuantity || 0) * packageSize + Number(draft.looseQuantity || 0)
        : Number(draft.quantity || 0),
      reorderPoint: draft.usesPackages
        ? Number(draft.reorderPackageQuantity || 0) * packageSize + Number(draft.reorderLooseQuantity || 0)
        : Number(draft.reorderPoint || 0),
      packageUnit: draft.usesPackages ? draft.packageUnit : '',
      unitsPerPackage: draft.usesPackages ? packageSize : null
    });
  };

  return (
    <div className="page-shell logistics-page">
      <div className="page-header logistics-page-header">
        <div>
          <div className="panel-kicker">Operations</div>
          <h2>Logistics Inventory</h2>
          <p>Track supplies for cleaning, events, activities, and daily use. Items at or below their reorder point appear here and in the daily Telegram reminder.</p>
        </div>
        <button type="button" onClick={onSendReminder}>Send Telegram Reminder</button>
      </div>

      {lowStockItems.length ? (
        <section className="logistics-alert" role="status">
          <div>
            <span className="logistics-alert-icon" aria-hidden="true">!</span>
            <div>
              <strong>{lowStockItems.length} item{lowStockItems.length === 1 ? '' : 's'} need reordering</strong>
              <p>{lowStockItems.map((item) => `${item.name} (${describeQuantity(item.quantity, item)})`).join(' · ')}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="logistics-clear" role="status">
          <strong>Stock levels are healthy</strong>
          <span>No active item is currently at its reorder point.</span>
        </section>
      )}

      <section className="stats-row logistics-stats" aria-label="Logistics summary">
        <article className="stat-card"><span>Tracked items</span><strong>{items.length}</strong></article>
        <article className="stat-card"><span>Ready to reorder</span><strong>{lowStockItems.length}</strong></article>
        <article className="stat-card"><span>Categories in use</span><strong>{new Set(items.map((item) => item.category)).size}</strong></article>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Add an inventory item</h2>
            <p>Set the current amount and the point where the website and Telegram should remind you to reorder.</p>
          </div>
        </div>
        <form className="logistics-create-form" onSubmit={handleCreate}>
          <label>
            Item name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Paper towels" required />
          </label>
          <label>
            Category
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Base unit
            <input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="piece, bottle, roll, liter, kg" required />
          </label>
          <label className="inline-checkbox logistics-package-toggle">
            <input
              type="checkbox"
              checked={draft.usesPackages}
              onChange={(event) => setDraft({ ...draft, usesPackages: event.target.checked })}
            />
            This item comes in packages
          </label>
          {draft.usesPackages ? (
            <>
              <label>
                Package name
                <input value={draft.packageUnit} onChange={(event) => setDraft({ ...draft, packageUnit: event.target.value })} placeholder="box, bag, pack, carton" required />
              </label>
              <label>
                Base units per package
                <input type="number" min="0.01" step="any" value={draft.unitsPerPackage} onChange={(event) => setDraft({ ...draft, unitsPerPackage: event.target.value })} placeholder="24" required />
              </label>
              <label>
                Current full packages
                <input type="number" min="0" step="any" value={draft.packageQuantity} onChange={(event) => setDraft({ ...draft, packageQuantity: event.target.value })} required />
              </label>
              <label>
                Current loose {draft.unit || 'units'}
                <input type="number" min="0" step="any" value={draft.looseQuantity} onChange={(event) => setDraft({ ...draft, looseQuantity: event.target.value })} required />
              </label>
              <label>
                Reorder at full packages
                <input type="number" min="0" step="any" value={draft.reorderPackageQuantity} onChange={(event) => setDraft({ ...draft, reorderPackageQuantity: event.target.value })} required />
              </label>
              <label>
                Plus loose {draft.unit || 'units'}
                <input type="number" min="0" step="any" value={draft.reorderLooseQuantity} onChange={(event) => setDraft({ ...draft, reorderLooseQuantity: event.target.value })} required />
              </label>
              <div className="package-conversion-preview">
                <span>Current total</span>
                <strong>
                  {packageDetailsValid
                    ? describeQuantity(Number(draft.packageQuantity || 0) * packageSize + Number(draft.looseQuantity || 0), draft)
                    : 'Enter a package size'}
                </strong>
              </div>
            </>
          ) : (
            <>
              <label>
                Current quantity
                <input type="number" min="0" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} required />
              </label>
              <label>
                Reorder point
                <input type="number" min="0" step="any" value={draft.reorderPoint} onChange={(event) => setDraft({ ...draft, reorderPoint: event.target.value })} required />
              </label>
            </>
          )}
          <label>
            Storage location
            <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Main storage room" />
          </label>
          <label className="logistics-notes-field">
            Notes
            <input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Preferred brand or supplier" />
          </label>
          <button type="submit">Add Item</button>
          <div className="logistics-form-help">
            <strong>Example:</strong> 3 boxes × 24 pieces + 5 loose pieces = 77 pieces. You can also track liters, kilograms, rolls, bottles, or whole bags directly.
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-head logistics-list-head">
          <div>
            <h2>Current inventory</h2>
            <p>Use − and + for quick daily adjustments, or edit any field and save the row.</p>
          </div>
          <label>
            Show category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap logistics-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Packaging</th>
                <th>Reorder at</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <InventoryRow key={item.id} item={item} onSave={onSave} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
          {!visibleItems.length ? <div className="repository-empty-state"><strong>No inventory items yet.</strong><span>Add the first item above to begin tracking stock.</span></div> : null}
        </div>
      </section>
    </div>
  );
}
