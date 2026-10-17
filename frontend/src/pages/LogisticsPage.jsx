import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, downloadFile } from '../lib/app';

const tabs = [['overview', 'Overview'], ['center', 'Center Logistics'], ['programs', 'Program Logistics'], ['activities', 'Activities'], ['history', 'Movement History'], ['reports', 'Reports']];
const activityActions = { borrow: 'Take Items', return: 'Return Items', consume: 'Record Consumption', loss: 'Record Loss', damage: 'Record Damage' };
const emptyItem = (scope = 'center') => ({ name: '', category: 'daily-use', scope, itemType: 'reusable', quantity: 0, unit: 'units', reorderPoint: 0, targetStock: '', location: '', notes: '', usesPackages: false, packageUnit: '', unitsPerPackage: '', packageQuantity: 0, looseQuantity: 0 });
const emptyActivity = (scope = 'program-1') => ({ name: '', scope, description: '', startDate: '', endDate: '', responsiblePerson: '' });
const emptyMovement = () => ({ type: 'borrow', itemId: '', quantity: 1, quantityMode: 'unit', activityId: '', activityDate: '', notes: '', idempotencyKey: crypto.randomUUID() });
const scopeName = (scopes, id) => scopes.find((entry) => entry.id === id)?.name || id;
const formatted = (value) => Number.isInteger(Number(value)) ? Number(value) : Number(value).toFixed(2);

function activityDays(activity, movements) {
  if (!activity) return [];
  const running = new Map();
  return activity.days.map((day) => {
    const rows = new Map();
    movements.filter((entry) => entry.activityId === activity.id && entry.activityDate === day).forEach((entry) => {
      const row = rows.get(entry.itemId) || { itemId: entry.itemId, itemName: entry.itemName, owner: entry.scope, taken: 0, returned: 0, consumed: 0, lost: 0, damaged: 0 };
      if (entry.type === 'borrow') row.taken += entry.quantity;
      if (entry.type === 'return') row.returned += entry.quantity;
      if (entry.type === 'consume') row.consumed += entry.quantity;
      if (entry.type === 'loss') row.lost += entry.quantity;
      if (entry.type === 'damage') row.damaged += entry.quantity;
      rows.set(entry.itemId, row);
    });
    const dayRows = [...rows.values()].map((row) => {
      const next = Number(running.get(row.itemId) || 0) + row.taken - row.returned - row.lost - row.damaged;
      running.set(row.itemId, next);
      return { ...row, outstanding: Math.max(0, next) };
    });
    return { day, rows: dayRows };
  });
}

function InventoryRow({ entry, scopes, editable, onSave, onHistory }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: entry.name, itemType: entry.itemType, reorderPoint: entry.reorderPoint, targetStock: entry.targetStock ?? '', unit: entry.unit, location: entry.location || '', notes: entry.notes || '' });
  useEffect(() => setDraft({ name: entry.name, itemType: entry.itemType, reorderPoint: entry.reorderPoint, targetStock: entry.targetStock ?? '', unit: entry.unit, location: entry.location || '', notes: entry.notes || '' }), [entry]);
  return <tr>
    <td>{editing ? <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /> : <><strong>{entry.name}</strong><small>{entry.unit}</small></>}</td>
    <td>{scopeName(scopes, entry.scope)}</td>
    <td>{editing ? <select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value })}><option value="reusable">Reusable</option><option value="consumable">Consumable</option></select> : entry.itemType}</td>
    <td>{entry.availableQuantity}</td><td>{entry.borrowedQuantity}</td><td>{entry.consumedQuantity}</td><td>{entry.lostQuantity} / {entry.damagedQuantity}</td>
    <td>{editing ? <><input aria-label="Reorder point" type="number" min="0" value={draft.reorderPoint} onChange={(event) => setDraft({ ...draft, reorderPoint: event.target.value })} /><input aria-label="Target stock" type="number" min="0" placeholder="Target" value={draft.targetStock} onChange={(event) => setDraft({ ...draft, targetStock: event.target.value })} /></> : <span className={`status-chip ${entry.isLowStock ? 'off' : 'on'}`}>{entry.isLowStock ? `Order ${entry.suggestedOrder}` : 'In stock'}</span>}</td>
    {editable || onHistory ? <td>{editing ? <><button type="button" onClick={async () => { if (await onSave(entry.id, draft)) setEditing(false); }}>Save</button><button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button></> : <>{editable ? <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit</button> : null}<button type="button" className="secondary" onClick={() => onHistory?.(entry.id)}>History</button></>}</td> : null}
  </tr>;
}

function InventoryPage({ title, explanation, selectedScope, scopes, items, canManage, canUse = false, cardLayout = false, busy, onScopeChange, onCreate, onSave, onStock, onUse, onHistory }) {
  const [draft, setDraft] = useState(() => emptyItem(selectedScope));
  const [stock, setStock] = useState({ itemId: '', type: 'restock', quantity: 1, quantityMode: 'unit', notes: '', idempotencyKey: crypto.randomUUID() });
  const [useStock, setUseStock] = useState({ itemId: '', type: 'borrow', quantity: 1, quantityMode: 'unit', purpose: '', notes: '', idempotencyKey: crypto.randomUUID() });
  const [dialog, setDialog] = useState('');
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    setDraft(emptyItem(selectedScope));
    setStock({ itemId: '', type: 'restock', quantity: 1, quantityMode: 'unit', notes: '', idempotencyKey: crypto.randomUUID() });
    setUseStock({ itemId: '', type: 'borrow', quantity: 1, quantityMode: 'unit', purpose: '', notes: '', idempotencyKey: crypto.randomUUID() });
    setDialog('');
  }, [selectedScope]);
  const visible = items.filter((entry) => entry.scope === selectedScope);
  const selectedStockItem = visible.find((entry) => entry.id === stock.itemId);
  const selectedUseItem = visible.find((entry) => entry.id === useStock.itemId);
  const openStock = (itemId = '', type = 'restock') => {
    setStock({ itemId, type, quantity: 1, quantityMode: 'unit', notes: '', idempotencyKey: crypto.randomUUID() });
    setDialog('stock');
  };
  const openUse = (type, itemId = '') => {
    setUseStock({ itemId, type, quantity: 1, quantityMode: 'unit', purpose: '', notes: '', idempotencyKey: crypto.randomUUID() });
    setDialog('use');
  };
  const closeDialog = () => setDialog('');
  const useChoices = visible.filter((entry) => useStock.type === 'consume' ? entry.itemType === 'consumable' : entry.itemType === 'reusable');
  return <section className="panel logistics-inventory-panel">
    <div className="section-head logistics-inventory-head">
      <div><span className="panel-kicker">Inventory</span><h2>{title}</h2><p>{explanation}</p></div>
      {onScopeChange ? <label>Program<select value={selectedScope} onChange={(event) => onScopeChange(event.target.value)}>{scopes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label> : null}
    </div>

    <div className="logistics-taskbar">
      <div className="logistics-taskbar-group">
        <span>Inventory setup</span>
        {canManage ? <button type="button" onClick={() => { setDraft(emptyItem(selectedScope)); setDialog('create'); }}>＋ Add New Item</button> : null}
        {canManage && visible.length ? <button type="button" className="secondary" onClick={() => openStock()}>＋ Restock Existing Item</button> : null}
        {canManage && visible.length ? <button type="button" className="secondary" onClick={() => openStock('', 'adjustment')}>Adjust Count</button> : null}
      </div>
      {canUse && selectedScope === 'center' && visible.length ? <div className="logistics-taskbar-group logistics-taskbar-operations">
        <span>Daily operations</span>
        <button type="button" onClick={() => openUse('borrow')}>Take Reusable Item</button>
        <button type="button" onClick={() => openUse('consume')}>Use Consumable</button>
        <button type="button" className="secondary" onClick={() => openUse('return')}>Return Item</button>
      </div> : null}
    </div>

    {!visible.length ? <div className="repository-empty-state"><strong>No inventory items yet.</strong><span>Add the first item to begin tracking this inventory.</span>{canManage ? <button type="button" onClick={() => setDialog('create')}>Add First Item</button> : null}</div> : null}
    {cardLayout ? <div className="inventory-item-grid">{visible.map((entry) => <article className="inventory-item-card" key={entry.id}>
      <div className="inventory-item-card-head"><div><span>{entry.category}</span><h3>{entry.name}</h3></div><span className={`inventory-status ${entry.stockStatus}`}>{entry.stockStatus.replaceAll('-', ' ')}</span></div>
      <strong className="inventory-quantity">{entry.availableQuantity} <small>{entry.unit} available</small></strong>
      {entry.unitsPerPackage ? <p>Equivalent to {entry.fullPackageEquivalent} {entry.packageUnit}{entry.fullPackageEquivalent === 1 ? '' : 's'} + {entry.looseUnitEquivalent} {entry.unit}</p> : <p>{entry.borrowedQuantity} currently borrowed</p>}
      <div className="inventory-card-actions">
        {canUse ? <button type="button" onClick={() => openUse(entry.itemType === 'consumable' ? 'consume' : 'borrow', entry.id)}>{entry.itemType === 'consumable' ? 'Use' : 'Take'}</button> : null}
        {canUse && entry.itemType === 'reusable' && entry.borrowedQuantity > 0 ? <button type="button" className="secondary" onClick={() => openUse('return', entry.id)}>Return</button> : null}
        {canManage ? <button type="button" className="secondary" onClick={() => openStock(entry.id)}>Restock</button> : null}
        {canManage ? <button type="button" className="quiet-button" onClick={() => setEditing(entry)}>Edit</button> : null}
        <button type="button" className="quiet-button" onClick={() => onHistory?.(entry.id)}>History</button>
      </div>
    </article>)}</div> : <div className="table-wrap"><table><thead><tr><th>Item</th><th>Owner</th><th>Type</th><th>Available</th><th>Borrowed</th><th>Consumed</th><th>Lost / damaged</th><th>Status</th>{canManage || onHistory ? <th>Actions</th> : null}</tr></thead><tbody>{visible.map((entry) => <InventoryRow key={entry.id} entry={entry} scopes={scopes} editable={canManage} onSave={onSave} onHistory={onHistory} />)}</tbody></table></div>}

    {dialog === 'create' ? createPortal(<div className="modal-backdrop modal-backdrop-top" onClick={closeDialog}><form className="modal-card logistics-action-modal logistics-create-item-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onCreate({ ...draft, scope: selectedScope, packageUnit: draft.usesPackages ? draft.packageUnit : '', unitsPerPackage: draft.usesPackages ? draft.unitsPerPackage : null, packageQuantity: draft.usesPackages ? draft.packageQuantity : null, looseQuantity: draft.usesPackages ? draft.looseQuantity : null }, () => { setDraft(emptyItem(selectedScope)); closeDialog(); }); }}>
      <div className="modal-head"><div><span className="panel-kicker">Inventory setup</span><h2>Add a new item</h2><p>Create the item once. Stock usage is recorded separately.</p></div><button type="button" className="secondary" onClick={closeDialog}>Close</button></div>
      <div className="logistics-form-section"><h3>Item details</h3><div className="logistics-dialog-grid"><label>Item name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required autoFocus /></label><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="cleaning">Cleaning</option><option value="events">Events</option><option value="activities">Activities</option><option value="daily-use">Daily use</option><option value="other">Other</option></select></label><label>Item behavior<select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value })}><option value="reusable">Reusable — taken and returned</option><option value="consumable">Consumable — used permanently</option></select></label><label>Base unit<input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="piece, roll, bottle" required /></label><label>Storage location<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label><label>Reorder point<input type="number" min="0" step="any" value={draft.reorderPoint} onChange={(event) => setDraft({ ...draft, reorderPoint: event.target.value })} /></label></div></div>
      <div className="logistics-form-section"><label className="logistics-package-switch"><input type="checkbox" checked={draft.usesPackages} onChange={(event) => setDraft({ ...draft, usesPackages: event.target.checked })} /><div><strong>Purchased in packages</strong><span>Enable this for boxes, packs, or cartons.</span></div></label>{draft.usesPackages ? <div className="logistics-dialog-grid"><label>Package type<input value={draft.packageUnit} onChange={(event) => setDraft({ ...draft, packageUnit: event.target.value })} placeholder="Box, pack, carton" required /></label><label>Units per package<input type="number" min="1" step="any" value={draft.unitsPerPackage} onChange={(event) => setDraft({ ...draft, unitsPerPackage: event.target.value })} required /></label><label>Opening full packages<input type="number" min="0" step="any" value={draft.packageQuantity} onChange={(event) => setDraft({ ...draft, packageQuantity: event.target.value })} /></label><label>Opening loose units<input type="number" min="0" step="any" value={draft.looseQuantity} onChange={(event) => setDraft({ ...draft, looseQuantity: event.target.value })} /></label></div> : <div className="logistics-dialog-grid"><label>Opening quantity<input type="number" min="0" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></label><label>Target stock<input type="number" min="0" step="any" value={draft.targetStock} onChange={(event) => setDraft({ ...draft, targetStock: event.target.value })} /></label></div>}{draft.usesPackages && Number(draft.unitsPerPackage) > 0 ? <div className="package-conversion-preview"><span>Opening stock in base units</span><strong>{Number(draft.packageQuantity || 0) * Number(draft.unitsPerPackage) + Number(draft.looseQuantity || 0)} {draft.unit}</strong></div> : null}</div>
      <div className="logistics-modal-actions"><button type="button" className="secondary" onClick={closeDialog}>Cancel</button><button disabled={busy}>Add Item</button></div>
    </form></div>, document.body) : null}

    {dialog === 'stock' ? createPortal(<div className="modal-backdrop modal-backdrop-top" onClick={closeDialog}><form className="modal-card logistics-action-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onStock(stock, closeDialog); }}>
      <div className="modal-head"><div><span className="panel-kicker">Inventory setup</span><h2>{stock.type === 'restock' ? 'Restock an item' : 'Adjust inventory count'}</h2><p>{stock.type === 'restock' ? 'Record newly received stock. This does not withdraw any items.' : 'Correct the recorded balance and provide a reason.'}</p></div><button type="button" className="secondary" onClick={closeDialog}>Close</button></div>
      <label>Item<select value={stock.itemId} onChange={(event) => setStock({ ...stock, itemId: event.target.value, quantityMode: 'unit' })} required><option value="">Choose item</option>{visible.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.availableQuantity} {entry.unit} available</option>)}</select></label>
      {selectedStockItem?.unitsPerPackage ? <label>Add stock as<select value={stock.quantityMode} onChange={(event) => setStock({ ...stock, quantityMode: event.target.value })}><option value="unit">Individual {selectedStockItem.unit}</option><option value="package">Full {selectedStockItem.packageUnit}</option></select></label> : null}
      <label>{stock.type === 'adjustment' ? 'Quantity change' : 'Quantity received'}<input type="number" step="any" min={stock.type === 'restock' ? '0.01' : undefined} value={stock.quantity} onChange={(event) => setStock({ ...stock, quantity: event.target.value })} required /><small>{stock.type === 'adjustment' ? 'Use a negative number to reduce the recorded balance.' : 'This quantity will be added to available stock.'}</small></label>
      <label>{stock.type === 'adjustment' ? 'Reason for adjustment' : 'Delivery note (optional)'}<textarea value={stock.notes} onChange={(event) => setStock({ ...stock, notes: event.target.value })} required={stock.type === 'adjustment'} /></label>
      <div className="logistics-modal-actions"><button type="button" className="secondary" onClick={closeDialog}>Cancel</button><button disabled={busy}>{stock.type === 'restock' ? 'Confirm Restock' : 'Save Adjustment'}</button></div>
    </form></div>, document.body) : null}

    {dialog === 'use' ? createPortal(<div className="modal-backdrop modal-backdrop-top" onClick={closeDialog}><form className="modal-card logistics-action-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onUse(useStock, closeDialog); }}>
      <div className="modal-head"><div><span className="panel-kicker">Daily operations</span><h2>{activityActions[useStock.type]}</h2><p>{useStock.type === 'borrow' ? 'Record reusable equipment leaving the Center. It will remain borrowed until returned.' : useStock.type === 'return' ? 'Return previously borrowed equipment to available stock.' : useStock.type === 'consume' ? 'Record supplies used in daily Center operations.' : 'Record an inventory exception with a clear reason.'}</p></div><button type="button" className="secondary" onClick={closeDialog}>Close</button></div>
      <label>Item<select value={useStock.itemId} onChange={(event) => setUseStock({ ...useStock, itemId: event.target.value, quantityMode: 'unit' })} required><option value="">Choose item</option>{useChoices.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {useStock.type === 'return' ? `${entry.borrowedQuantity} borrowed` : `${entry.availableQuantity} available`}</option>)}</select></label>
      {selectedUseItem?.unitsPerPackage ? <label>Quantity format<select value={useStock.quantityMode} onChange={(event) => setUseStock({ ...useStock, quantityMode: event.target.value })}><option value="unit">Individual {selectedUseItem.unit}</option><option value="package">Full {selectedUseItem.packageUnit}</option></select></label> : null}
      <label>Quantity<input type="number" min="0.01" step="any" value={useStock.quantity} onChange={(event) => setUseStock({ ...useStock, quantity: event.target.value })} required /></label>
      {['borrow', 'consume'].includes(useStock.type) ? <label>Purpose<input value={useStock.purpose} onChange={(event) => setUseStock({ ...useStock, purpose: event.target.value })} placeholder="Where or why will this be used?" required /></label> : null}
      <label>{['loss', 'damage'].includes(useStock.type) ? 'Reason' : 'Notes (optional)'}<textarea value={useStock.notes} onChange={(event) => setUseStock({ ...useStock, notes: event.target.value })} required={['loss', 'damage'].includes(useStock.type)} /></label>
      <div className="logistics-modal-actions"><button type="button" className="secondary" onClick={closeDialog}>Cancel</button><button disabled={busy}>{activityActions[useStock.type]}</button></div>
    </form></div>, document.body) : null}

    {editing ? createPortal(<div className="modal-backdrop modal-backdrop-top" onClick={() => setEditing(null)}><form className="modal-card logistics-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); if (await onSave(editing.id, editing)) setEditing(null); }}><div className="modal-head"><div><h2>Edit {editing.name}</h2><p>Update item details without changing stock quantities.</p></div><button type="button" className="secondary" onClick={() => setEditing(null)}>Close</button></div><label>Item name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Reorder point<input type="number" min="0" value={editing.reorderPoint} onChange={(event) => setEditing({ ...editing, reorderPoint: event.target.value })} /></label><label>Target stock<input type="number" min="0" value={editing.targetStock ?? ''} onChange={(event) => setEditing({ ...editing, targetStock: event.target.value })} /></label><label>Storage location<input value={editing.location || ''} onChange={(event) => setEditing({ ...editing, location: event.target.value })} /></label><label>Notes<textarea value={editing.notes || ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label><div className="logistics-modal-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button><button>Save Item</button></div></form></div>, document.body) : null}
  </section>;
}

export default function LogisticsPage({ token, onInventoryChange, onNotice, onError }) {
  const [data, setData] = useState({ scopes: [], permissions: { permissions: {}, scopes: [] }, items: [], activities: [], movements: [], summary: {}, scopeSummaries: [] });
  const [tab, setTab] = useState('overview');
  const [programScope, setProgramScope] = useState('program-1');
  const [programSection, setProgramSection] = useState('inventory');
  const [reportScope, setReportScope] = useState('');
  const [activity, setActivity] = useState(() => emptyActivity());
  const [movement, setMovement] = useState(emptyMovement);
  const [openedActivityId, setOpenedActivityId] = useState('');
  const [activityDetail, setActivityDetail] = useState(null);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [activityOperation, setActivityOperation] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const payload = await api('/api/logistics/dashboard', { token }); setData(payload); onInventoryChange?.(payload.items); }
    catch (error) { onError?.(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!openedActivityId) { setActivityDetail(null); return; }
    api(`/api/logistics/activities/${openedActivityId}`, { token }).then(setActivityDetail).catch((error) => onError?.(error.message));
  }, [openedActivityId]);
  const can = (permission) => data.permissions.full || data.permissions.permissions?.[permission];
  const ownedScopes = data.permissions.full ? data.scopes.map(({ id }) => id) : data.permissions.scopes || [];
  const programScopes = data.scopes.filter((entry) => entry.kind === 'program' && ownedScopes.includes(entry.id));
  const canManageCenter = can('manageInventory') && ownedScopes.includes('center');
  const selectedActivity = data.activities.find((entry) => entry.id === movement.activityId);
  const dashboardActivity = data.activities.find((entry) => entry.id === openedActivityId);
  const openedActivity = activityDetail?.activity ? { ...activityDetail.activity, ...dashboardActivity } : dashboardActivity;
  const openedDays = activityDays(openedActivity, activityDetail?.movements || data.movements);
  const outstandingItems = openedDays.flatMap((entry) => entry.rows).reduce((map, row) => map.set(row.itemId, { ...row }), new Map());
  const activityItems = activityDetail?.items || data.items;
  const outstandingAction = ['return', 'loss', 'damage'].includes(movement.type);
  const eligibleActivityItems = activityItems.filter((entry) => selectedActivity
    && (entry.scope === 'center' || entry.scope === selectedActivity.scope)
    && (movement.type === 'consume' ? entry.itemType === 'consumable' : entry.itemType === 'reusable')
    && (!outstandingAction || Number(outstandingItems.get(entry.id)?.outstanding || 0) > 0));
  const selectedActivityItem = activityItems.find((entry) => entry.id === movement.itemId);

  useEffect(() => {
    if (programScopes.length && !programScopes.some(({ id }) => id === programScope)) setProgramScope(programScopes[0].id);
    if (programScopes.length && !programScopes.some(({ id }) => id === activity.scope)) setActivity((current) => ({ ...current, scope: programScopes[0].id }));
  }, [data.scopes]);

  const submit = async (path, body, reset) => {
    setBusy(true);
    try { await api(path, { token, method: 'POST', body }); reset?.(); await load(); if (openedActivityId) await openActivity(openedActivityId, false); onNotice?.('Logistics updated successfully.'); return true; }
    catch (error) { onError?.(error.message); return false; }
    finally { setBusy(false); }
  };
  const openActivity = async (entryOrId, navigate = true) => {
    const id = typeof entryOrId === 'string' ? entryOrId : entryOrId.id;
    try {
      const payload = await api(`/api/logistics/activities/${id}`, { token });
      setActivityDetail(payload); setOpenedActivityId(id);
      setMovement((current) => ({ ...current, activityId: id, itemId: '', activityDate: '' }));
      if (navigate) setTab('activities');
    } catch (error) { onError?.(error.message); }
  };
  const saveItem = async (id, updates) => {
    const body = Object.fromEntries(['name', 'itemType', 'reorderPoint', 'targetStock', 'unit', 'location', 'notes'].filter((key) => updates[key] !== undefined).map((key) => [key, updates[key]]));
    try { await api(`/api/logistics/${id}`, { token, method: 'PUT', body }); await load(); onNotice?.('Item details updated.'); return true; }
    catch (error) { onError?.(error.message); return false; }
  };

  if (loading && !data.scopes.length) return <div className="panel"><p>Loading Logistics…</p></div>;
  return <div className="page-shell logistics-hub">
    <div className="page-header"><div><div className="panel-kicker">Operations</div><h2>Logistics</h2><p>Center stock, program stock, and activity usage are kept on separate pages while sharing one reliable movement history.</p></div></div>
    <nav className="logistics-tabs" aria-label="Logistics sections">{tabs.filter(([id]) => id !== 'center' || ownedScopes.includes('center')).map(([id, label]) => <button key={id} type="button" className={tab === id ? 'active' : 'secondary'} onClick={() => setTab(id)}>{label}</button>)}</nav>

    {tab === 'overview' ? <>
      <section className="stats-row logistics-stats"><article className="stat-card"><span>Total Items</span><strong>{data.items.filter((item) => ownedScopes.includes(item.scope)).length}</strong></article><article className="stat-card"><span>Currently Borrowed</span><strong>{formatted(data.items.filter((item) => ownedScopes.includes(item.scope)).reduce((sum, item) => sum + item.borrowedQuantity, 0))}</strong></article><article className="stat-card"><span>Low Stock</span><strong>{data.items.filter((item) => ownedScopes.includes(item.scope) && item.isLowStock).length}</strong></article><article className="stat-card"><span>Active Activities</span><strong>{data.activities.filter((entry) => ['active', 'outstanding', 'upcoming'].includes(entry.status)).length}</strong></article></section>
      <section><div className="section-head"><div><h2>Choose an inventory</h2><p>Open Center Logistics or one of the program workspaces. Each inventory keeps its own quantities and access.</p></div></div><div className="logistics-dashboard-grid">{data.scopeSummaries.filter((entry) => ownedScopes.includes(entry.id)).map((entry, index) => <article className={`logistics-dashboard-card scope-${index}`} key={entry.id}><div className="logistics-dashboard-icon" aria-hidden="true">{entry.kind === 'center' ? '✚' : entry.id === 'program-1' ? '♥' : entry.id === 'program-2' ? '⚕' : '♻'}</div><div><span className="panel-kicker">{entry.kind === 'center' ? 'Shared operations' : 'Program inventory'}</span><h3>{entry.name}{entry.kind === 'program' ? ' Logistics' : ''}</h3><p>{entry.kind === 'center' ? 'Manage the Center’s supplies, package quantities, and daily usage.' : `Manage ${entry.name} materials and activity logistics.`}</p></div><div className="logistics-dashboard-metrics"><span><strong>{entry.itemCount}</strong> items</span><span><strong>{entry.borrowed}</strong> borrowed</span><span><strong>{entry.lowStock}</strong> low stock</span></div><button type="button" onClick={() => { if (entry.kind === 'center') setTab('center'); else { setProgramScope(entry.id); setProgramSection('inventory'); setTab('programs'); } }}>Open Logistics</button></article>)}</div></section>
    </> : null}

    {tab === 'center' ? <InventoryPage title="Center Logistics" explanation="Review Center stock here. Use the separate action groups below for inventory setup and daily withdrawals or returns." selectedScope="center" scopes={data.scopes} items={data.items} canManage={canManageCenter} canUse={can('recordMovements') && ownedScopes.includes('center')} cardLayout busy={busy} onCreate={(body, reset) => submit('/api/logistics', body, reset)} onSave={saveItem} onStock={(body, reset) => submit('/api/logistics/movements', body, reset)} onUse={(body, reset) => submit('/api/logistics/movements', body, reset)} onHistory={() => setTab('history')} /> : null}
    {tab === 'programs' ? programScopes.length ? <div className="program-workspace">
      <div className="section-head program-logistics-head"><div><span className="panel-kicker">Program workspace</span><h2>{scopeName(data.scopes, programScope)} Logistics</h2><p>Choose one task area at a time. Inventory and activities remain separate.</p></div><label>Program<select value={programScope} onChange={(event) => { setProgramScope(event.target.value); setProgramSection('inventory'); }}>{programScopes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div>
      <div className="program-section-switcher" role="tablist" aria-label="Program logistics sections">
        <button type="button" role="tab" aria-selected={programSection === 'inventory'} className={programSection === 'inventory' ? 'active' : ''} onClick={() => setProgramSection('inventory')}><span>▦</span><div><strong>Program Inventory</strong><small>Add, restock, and review program-owned materials.</small></div><em>{data.items.filter((entry) => entry.scope === programScope).length} items</em></button>
        <button type="button" role="tab" aria-selected={programSection === 'activities'} className={programSection === 'activities' ? 'active' : ''} onClick={() => setProgramSection('activities')}><span>◷</span><div><strong>Activity Logistics</strong><small>Take and return materials for scheduled activities.</small></div><em>{data.activities.filter((entry) => entry.scope === programScope).length} activities</em></button>
      </div>
      {programSection === 'inventory' ? <InventoryPage title="Program Inventory" explanation="This page contains only materials owned by this program. Materials for activities are handled from Activity Logistics." selectedScope={programScope} scopes={programScopes} items={data.items} canManage={can('manageInventory')} busy={busy} onCreate={(body, reset) => submit('/api/logistics', body, reset)} onSave={saveItem} onStock={(body, reset) => submit('/api/logistics/movements', body, reset)} onHistory={() => setTab('history')} /> : null}
      {programSection === 'activities' ? <section className="panel"><div className="section-head"><div><span className="panel-kicker">Activity logistics</span><h2>Program Activities</h2><p>Open an activity to record daily withdrawals and returns. Inventory setup is not shown here.</p></div>{can('manageActivities') ? <button type="button" onClick={() => { setActivity(emptyActivity(programScope)); setOpenedActivityId(''); setActivityOperation(''); setTab('activities'); }}>＋ Create Activity</button> : null}</div>{data.activities.some((entry) => entry.scope === programScope) ? <div className="activity-card-grid">{data.activities.filter((entry) => entry.scope === programScope).map((entry) => <button type="button" className="activity-card" key={entry.id} onClick={() => { setOpenedActivityId(entry.id); setActivityOperation(''); setMovement((current) => ({ ...current, activityId: entry.id, activityDate: '' })); setTab('activities'); }}><span className={`activity-status ${entry.status}`}>{entry.status}</span><h3>{entry.name}</h3><p>{entry.startDate} → {entry.endDate}</p><small>{entry.responsiblePerson || 'No responsible member assigned'}</small><div><strong>{entry.outstandingItemCount || entry.itemCount || 0}</strong> borrowed item types · <strong>{entry.outstandingQuantity}</strong> outstanding</div></button>)}</div> : <div className="repository-empty-state"><strong>No activities yet.</strong><span>Create an activity when the program needs materials for an event.</span></div>}</section> : null}
    </div> : <section className="panel"><h2>Program Logistics</h2><p>No program inventory has been assigned to your account.</p></section> : null}

    {tab === 'activities' ? <section className="panel activity-workspace"><div className="section-head"><div><span className="panel-kicker">Activity logistics</span><h2>{openedActivity ? openedActivity.name : 'Create Activity'}</h2><p>{openedActivity ? `${scopeName(data.scopes, openedActivity.scope)} · ${openedActivity.startDate} to ${openedActivity.endDate} · Responsible: ${openedActivity.responsiblePerson || 'Not assigned'}` : 'Set up the activity here. Materials are recorded only after the activity is created.'}</p></div>{openedActivity ? <button type="button" className="secondary" onClick={() => { setProgramScope(openedActivity.scope); setProgramSection('activities'); setOpenedActivityId(''); setActivityOperation(''); setTab('programs'); }}>Back to Activities</button> : null}</div>
      {!openedActivity && can('manageActivities') && programScopes.length ? <form className="logistics-inline-form" onSubmit={(event) => { event.preventDefault(); submit('/api/logistics/activities', activity, () => setActivity(emptyActivity(programScopes[0]?.id))); }}><label>Activity name<input value={activity.name} onChange={(event) => setActivity({ ...activity, name: event.target.value })} required /></label><label>Program<select value={activity.scope} onChange={(event) => setActivity({ ...activity, scope: event.target.value })}>{programScopes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Start date<input type="date" value={activity.startDate} onChange={(event) => setActivity({ ...activity, startDate: event.target.value })} required /></label><label>End date<input type="date" value={activity.endDate} onChange={(event) => setActivity({ ...activity, endDate: event.target.value })} required /></label><label>Responsible person<input value={activity.responsiblePerson} onChange={(event) => setActivity({ ...activity, responsiblePerson: event.target.value })} /></label><label>Description<input value={activity.description} onChange={(event) => setActivity({ ...activity, description: event.target.value })} /></label><button disabled={busy}>Create Activity</button></form> : null}
      {openedActivity ? <>
        <div className="activity-overview-strip"><span><strong>{openedActivity.days.length}</strong> days</span><span><strong>{openedActivity.borrowedQuantity}</strong> taken</span><span><strong>{openedActivity.outstandingQuantity}</strong> outstanding</span><span className={`activity-status ${openedActivity.status}`}>{openedActivity.status}</span></div>
        {can('recordMovements') ? <div className="activity-operation-panel"><div><span className="panel-kicker">Choose an operation</span><h3>What do you need to record?</h3><p>Each operation opens a focused form. Inventory configuration stays on the Program Inventory page.</p></div><div className="activity-action-bar"><button type="button" onClick={() => { setActivityOperation('borrow'); setMovement((current) => ({ ...current, type: 'borrow', activityId: openedActivity.id, itemId: '' })); }}>Take Items</button><button type="button" onClick={() => { setActivityOperation('return'); setMovement((current) => ({ ...current, type: 'return', activityId: openedActivity.id, itemId: '' })); }}>Return Items</button><button type="button" className="secondary" onClick={() => { setActivityOperation('consume'); setMovement((current) => ({ ...current, type: 'consume', activityId: openedActivity.id, itemId: '' })); }}>Record Consumption</button><button type="button" className="secondary" onClick={() => { setActivityOperation('loss'); setMovement((current) => ({ ...current, type: 'loss', activityId: openedActivity.id, itemId: '' })); }}>Loss / Damage</button><button type="button" className="quiet-button" onClick={() => setShowOutstanding((current) => !current)}>Outstanding Items</button></div></div> : null}
        {showOutstanding ? <div className="outstanding-panel"><div className="section-head"><div><h3>Outstanding returns</h3><p>These reusable items are still assigned to this activity.</p></div><button type="button" className="secondary" onClick={() => setShowOutstanding(false)}>Close</button></div>{[...outstandingItems.values()].some((entry) => entry.outstanding > 0) ? [...outstandingItems.values()].filter((entry) => entry.outstanding > 0).map((entry) => <p key={entry.itemId}><strong>{entry.itemName}</strong><span>{entry.outstanding} outstanding · {scopeName(data.scopes, entry.owner)}</span></p>) : <p className="empty-copy">Everything has been returned or resolved.</p>}</div> : null}
        <div className="activity-days-section"><div><span className="panel-kicker">Daily record</span><h3>Activity days</h3></div><div className="activity-days-grid">{openedDays.map((entry, index) => <article className="activity-day-card" key={entry.day}><span>Day {index + 1}</span><h3>{entry.day}</h3>{entry.rows.length ? entry.rows.map((row) => <div className="activity-day-row" key={row.itemId}><strong>{row.itemName}</strong><small>{scopeName(data.scopes, row.owner)}</small><p>Taken: {row.taken} · Returned: {row.returned} · Consumed: {row.consumed} · Outstanding: {row.outstanding}</p></div>) : <p className="empty-copy">No materials recorded for this day.</p>}</article>)}</div></div>
      </> : null}
      {openedActivity && can('recordMovements') && activityOperation ? <form className="activity-movement-editor" onSubmit={(event) => { event.preventDefault(); submit('/api/logistics/movements', movement, () => { setMovement({ ...emptyMovement(), activityId: openedActivity?.id || '' }); setActivityOperation(''); }); }}>
        <div className="activity-movement-editor-head"><div><span className="panel-kicker">{scopeName(data.scopes, openedActivity.scope)} activity</span><h3>{activityActions[movement.type]}</h3><p>{movement.type === 'borrow' ? 'Choose materials leaving inventory for this activity day.' : movement.type === 'return' ? 'Record reusable materials returned from this activity.' : movement.type === 'consume' ? 'Record consumable supplies permanently used by the activity.' : 'Record an item that cannot be returned, with a required reason.'}</p></div><button type="button" className="secondary" onClick={() => setActivityOperation('')}>Cancel</button></div>
        {activityOperation === 'loss' ? <label>Exception type<select value={movement.type} onChange={(event) => setMovement({ ...movement, type: event.target.value, itemId: '' })}><option value="loss">Lost</option><option value="damage">Damaged</option></select></label> : null}
        <label>Item owner and item<select value={movement.itemId} onChange={(event) => setMovement({ ...movement, itemId: event.target.value, quantityMode: 'unit' })} required><option value="">Choose Center or program item</option>{eligibleActivityItems.map((entry) => <option key={entry.id} value={entry.id}>{scopeName(data.scopes, entry.scope)} — {entry.name} ({outstandingAction ? `${outstandingItems.get(entry.id)?.outstanding || 0} outstanding` : `${entry.availableQuantity} available`})</option>)}</select></label>
        {selectedActivityItem?.unitsPerPackage ? <label>Count as<select value={movement.quantityMode} onChange={(event) => setMovement({ ...movement, quantityMode: event.target.value })}><option value="unit">{selectedActivityItem.unit}</option><option value="package">{selectedActivityItem.packageUnit}</option></select></label> : null}
        <label>Activity day<select value={movement.activityDate} onChange={(event) => setMovement({ ...movement, activityDate: event.target.value })} required><option value="">Choose day</option>{selectedActivity?.days.map((day) => <option key={day}>{day}</option>)}</select></label>
        <label>Quantity<input type="number" min="0.01" step="any" value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: event.target.value })} required /></label>
        <label>{['loss', 'damage'].includes(movement.type) ? 'Reason' : 'Notes (optional)'}<textarea value={movement.notes} onChange={(event) => setMovement({ ...movement, notes: event.target.value })} required={['loss', 'damage'].includes(movement.type)} /></label><button disabled={busy}>{activityActions[movement.type]}</button>
      </form> : null}
      {!openedActivity ? <div className="activity-card-grid">{data.activities.map((entry) => <button type="button" className="activity-card" key={entry.id} onClick={() => { setOpenedActivityId(entry.id); setMovement((current) => ({ ...current, activityId: entry.id, activityDate: '' })); }}><span className={`activity-status ${entry.status}`}>{entry.status}</span><h3>{entry.name}</h3><p>{entry.startDate} → {entry.endDate}</p><small>{scopeName(data.scopes, entry.scope)}</small></button>)}</div> : null}
    </section> : null}

    {tab === 'history' ? <section className="panel"><div className="section-head"><div><h2>Movement History</h2><p>Search every Center, program, and activity transaction without combining ownership balances.</p></div><label>Search history<input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Item, activity, purpose, member" /></label></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Item</th><th>Owner</th><th>Quantity</th><th>Activity / purpose</th><th>Responsible</th></tr></thead><tbody>{data.movements.filter((entry) => `${entry.itemName} ${entry.activityName} ${entry.purpose} ${entry.responsibleUserName} ${entry.type}`.toLowerCase().includes(historySearch.trim().toLowerCase())).map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{activityActions[entry.type] || entry.type}</td><td>{entry.itemName}</td><td>{scopeName(data.scopes, entry.scope)}</td><td>{entry.quantity}</td><td>{entry.activityName ? `${entry.activityName} · ${entry.activityDate}` : entry.purpose || '—'}</td><td>{entry.responsibleUserName}</td></tr>)}</tbody></table></div></section> : null}

    {tab === 'reports' ? <section className="panel"><div className="section-head"><div><h2>Reports</h2><p>Export Center, one program, or all authorized inventories. Center items used by a program activity are included in that program’s activity history.</p></div></div>{can('viewReports') ? <div className="logistics-report-actions"><label>Inventory<select value={reportScope} onChange={(event) => setReportScope(event.target.value)}><option value="">All authorized inventories</option>{data.scopes.filter((entry) => ownedScopes.includes(entry.id)).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button type="button" onClick={() => downloadFile(`/api/logistics/reports/inventory.xlsx${reportScope ? `?scope=${encodeURIComponent(reportScope)}` : ''}`, { token, filename: `logistics-${reportScope || 'all'}.xlsx` }).catch((error) => onError?.(error.message))}>Export to Excel</button></div> : <p>You do not have report access.</p>}</section> : null}
  </div>;
}
