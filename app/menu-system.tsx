"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type MenuItem = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  emoji: string;
  popular?: boolean;
};

type CartItem = MenuItem & { quantity: number };

type Order = {
  id: string;
  tableNo: number;
  status: "new" | "preparing" | "ready" | "served" | "closed";
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
  }>;
  note: string;
  total: number;
  createdAt: string;
};

type View = "menu" | "cashier" | "kitchen" | "qr";

const menuItems: MenuItem[] = [
  {
    id: 1,
    name: "Espresso",
    description: "Yoğun, aromatik ve keskin bir kahve.",
    category: "Sıcak Kahveler",
    price: 6500,
    emoji: "☕",
  },
  {
    id: 2,
    name: "Double Espresso",
    description: "Enerjiye ihtiyaç duyanlara ekstra yoğunluk.",
    category: "Sıcak Kahveler",
    price: 8000,
    emoji: "☕",
  },
  {
    id: 3,
    name: "Americano",
    description: "Espresso üzerine sıcak su; hafif ama karakterli.",
    category: "Sıcak Kahveler",
    price: 7000,
    emoji: "☕",
  },
  {
    id: 4,
    name: "Latte",
    description: "Espresso ve süt kremasının mükemmel dengesi.",
    category: "Sıcak Kahveler",
    price: 8500,
    emoji: "🥛",
    popular: true,
  },
  {
    id: 5,
    name: "Cappuccino",
    description: "Bol süt köpüğüyle kahve severlerin vazgeçilmezi.",
    category: "Sıcak Kahveler",
    price: 8500,
    emoji: "☕",
  },
  {
    id: 6,
    name: "Flat White",
    description: "Yoğun espresso ve kadifemsi sütün güçlü uyumu.",
    category: "Sıcak Kahveler",
    price: 9000,
    emoji: "🥛",
  },
  {
    id: 7,
    name: "Mocha",
    description: "Kahve, süt ve çikolatanın tatlı uyumu.",
    category: "Sıcak Kahveler",
    price: 9500,
    emoji: "🍫",
  },
  {
    id: 8,
    name: "Cold Brew",
    description: "16 saat demlenen, yumuşak içimli ve ferahlatıcı.",
    category: "Soğuk Kahveler",
    price: 9500,
    emoji: "🧊",
    popular: true,
  },
  {
    id: 9,
    name: "Iced Americano",
    description: "Klasik Amerikan kahvesinin buzla buluşmuş serin hali.",
    category: "Soğuk Kahveler",
    price: 8000,
    emoji: "🧊",
  },
  {
    id: 10,
    name: "Iced Latte",
    description: "Soğuk süt ve buzla hafif ama doyurucu.",
    category: "Soğuk Kahveler",
    price: 9000,
    emoji: "🥛",
  },
  {
    id: 11,
    name: "Espresso Tonic",
    description: "Tonik ve espressonun sıra dışı ferahlığı.",
    category: "Soğuk Kahveler",
    price: 9500,
    emoji: "🍹",
  },
  {
    id: 12,
    name: "Matcha Latte",
    description: "Antioksidan dolu Japon yeşil çayı ve süt.",
    category: "Özel İçecekler",
    price: 10000,
    emoji: "🍵",
    popular: true,
  },
  {
    id: 13,
    name: "Golden Milk",
    description: "Zerdeçal, tarçın, süt ve balın sıcak buluşması.",
    category: "Özel İçecekler",
    price: 9500,
    emoji: "🌙",
  },
  {
    id: 14,
    name: "Chai Latte",
    description: "Baharat karışımıyla zenginleştirilmiş sütlü çay.",
    category: "Özel İçecekler",
    price: 9000,
    emoji: "🫖",
  },
  {
    id: 15,
    name: "Kruvasan Sade",
    description: "Tereyağlı Fransız hamur işi; kahveyle mükemmel uyum.",
    category: "Tatlılar",
    price: 6500,
    emoji: "🥐",
  },
  {
    id: 16,
    name: "Kruvasan Çikolatalı",
    description: "Tereyağlı kruvasan ve yoğun çikolata dolgusu.",
    category: "Tatlılar",
    price: 7500,
    emoji: "🥐",
  },
  {
    id: 17,
    name: "Brownie",
    description: "Yoğun çikolata ve hafif nemli dokusuyla enerji dolu.",
    category: "Tatlılar",
    price: 8000,
    emoji: "🍫",
  },
  {
    id: 18,
    name: "Cheesecake",
    description: "Kremamsı hafifliğiyle klasik bir lezzet.",
    category: "Tatlılar",
    price: 9000,
    emoji: "🍰",
    popular: true,
  },
  {
    id: 19,
    name: "Granola Bowl",
    description: "Yoğurt, granola ve mevsim meyveleriyle sağlıklı seçim.",
    category: "Tatlılar",
    price: 9500,
    emoji: "🥣",
  },
];

const categories = [
  "Tümü",
  "Sıcak Kahveler",
  "Soğuk Kahveler",
  "Özel İçecekler",
  "Tatlılar",
];

const statusText: Record<Order["status"], string> = {
  new: "Sipariş alındı",
  preparing: "Hazırlanıyor",
  ready: "Hazır",
  served: "Teslim edildi",
  closed: "Hesap kapandı",
};

const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);

function readView(): View {
  if (typeof window === "undefined") return "menu";
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "kasa") return "cashier";
  if (view === "mutfak") return "kitchen";
  if (view === "qr") return "qr";
  return "menu";
}

export function MenuSystem() {
  const [view, setView] = useState<View>(readView);
  const [tableNo, setTableNo] = useState(5);
  const [category, setCategory] = useState("Tümü");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedTable = Number(params.get("table"));
    if (Number.isInteger(parsedTable) && parsedTable > 0) setTableNo(parsedTable);
  }, []);

  const navigate = (next: View) => {
    const urls: Record<View, string> = {
      menu: `?table=${tableNo}`,
      cashier: "?view=kasa",
      kitchen: "?view=mutfak",
      qr: "?view=qr",
    };
    window.history.pushState({}, "", urls[next]);
    setView(next);
  };

  const addToCart = (item: MenuItem) => {
    setCart((current) => {
      const match = current.find((cartItem) => cartItem.id === item.id);
      if (!match) return [...current, { ...item, quantity: 1 }];
      return current.map((cartItem) =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem,
      );
    });
  };

  const setQuantity = (id: number, quantity: number) => {
    setCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== id)
        : current.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const placeOrder = async () => {
    if (!cart.length || placing) return;
    setPlacing(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNo,
          note,
          items: cart.map(({ id, name, price, quantity }) => ({
            id,
            name,
            price,
            quantity,
          })),
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Sipariş gönderilemedi.");
      setConfirmedOrder(payload.id?.slice(0, 6).toUpperCase() ?? "");
      setCart([]);
      setNote("");
      setCartOpen(false);
      setStatusRefreshKey((current) => current + 1);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Sipariş gönderilemedi.",
      );
    } finally {
      setPlacing(false);
    }
  };

  if (view === "cashier") return <CashierScreen onNavigate={navigate} />;
  if (view === "kitchen") return <KitchenScreen onNavigate={navigate} />;
  if (view === "qr") return <QrScreen onNavigate={navigate} />;

  const visibleItems =
    category === "Tümü"
      ? menuItems
      : menuItems.filter((item) => item.category === category);

  return (
    <main className="guest-app">
      <header className="guest-topbar">
        <button className="brand-lockup" onClick={() => navigate("menu")}>
          <strong>masa<span>.</span></strong>
          <small>KAHVE &amp; MUTFAK</small>
        </button>
        <div className="guest-top-actions">
          <button
            className="table-label"
            onClick={() => navigate("qr")}
            aria-label={`Masa ${tableNo} QR kodları`}
          >
            <span>Masa</span>
            <strong>{String(tableNo).padStart(2, "0")}</strong>
          </button>
          <button
            className="round-admin-button"
            onClick={() => navigate("cashier")}
            aria-label="Yönetim panelini aç"
          >
            ☰
          </button>
        </div>
      </header>

      <nav className="menu-tabs" aria-label="Menü kategorileri">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <section className="coffee-hero">
        <div className="hero-copy-block">
          <p>MASA {String(tableNo).padStart(2, "0")} · HOŞ GELDİN</p>
          <h1>Bugün ne içersin?</h1>
          <span>Seç, sipariş ver; masaya getirelim.</span>
        </div>
        <div className="coffee-stamp" aria-hidden="true">
          <span className="stamp-rays">✦</span>
          <span className="stamp-cup">☕</span>
          <small>TAZE · SICAK · MUTLU</small>
        </div>
      </section>

      <CustomerOrderStatus
        tableNo={tableNo}
        refreshKey={statusRefreshKey}
      />

      <section className="menu-canvas">
        <div className="menu-title-row">
          <div>
            <p>MENÜ</p>
            <h2>{category}</h2>
          </div>
          <span>{visibleItems.length} ürün</span>
        </div>

        <div className="typographic-menu">
          {visibleItems.map((item) => (
            <article className="coffee-item" key={item.id}>
              <div className="item-icon" aria-hidden="true">
                {item.emoji}
              </div>
              <div className="item-copy">
                <div className="item-name-line">
                  <h3>{item.name}</h3>
                  <span className="dot-leader" />
                  <strong>{money(item.price)}</strong>
                </div>
                <p>{item.description}</p>
                <div className="item-meta">
                  <span>{item.category}</span>
                  {item.popular && <b>Çok sevilen</b>}
                </div>
              </div>
              <button
                className="square-add"
                onClick={() => addToCart(item)}
                aria-label={`${item.name} sepete ekle`}
              >
                +
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="menu-footer">
        <div>
          <strong>İyi kahve.</strong>
          <strong>İyi masa.</strong>
        </div>
        <p>
          Alerjen bilgisi için servis ekibimize danışabilirsiniz. Fiyatlara KDV
          dahildir.
        </p>
      </footer>

      {cartCount > 0 && (
        <button className="order-fab" onClick={() => setCartOpen(true)}>
          <span className="fab-count">{cartCount}</span>
          <span>Siparişi gör</span>
          <strong>{money(cartTotal)}</strong>
        </button>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside
            className="order-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-grip" />
            <header className="drawer-header">
              <div>
                <p>MASA {String(tableNo).padStart(2, "0")}</p>
                <h2>Siparişin</h2>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Sepeti kapat">
                ×
              </button>
            </header>
            <div className="drawer-items">
              {cart.map((item) => (
                <div className="drawer-line" key={item.id}>
                  <span className="drawer-emoji">{item.emoji}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{money(item.price)}</small>
                  </div>
                  <div className="quantity-stepper">
                    <button onClick={() => setQuantity(item.id, item.quantity - 1)}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => setQuantity(item.id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <label className="order-note-field">
              <span>Sipariş notu</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={300}
                placeholder="Örn. Şekersiz olsun"
              />
            </label>
            <div className="drawer-total">
              <span>Toplam</span>
              <strong>{money(cartTotal)}</strong>
            </div>
            <button
              className="send-order-button"
              disabled={placing}
              onClick={placeOrder}
            >
              {placing ? "Gönderiliyor…" : "Siparişi mutfağa gönder"}
            </button>
          </aside>
        </div>
      )}

      {confirmedOrder !== null && (
        <div className="success-overlay">
          <section className="success-ticket">
            <span className="success-mark">✓</span>
            <p>SİPARİŞ ALINDI</p>
            <h2>Hazırlamaya başlıyoruz.</h2>
            <span>Masa {tableNo} · Sipariş #{confirmedOrder}</span>
            <button onClick={() => setConfirmedOrder(null)}>Menüye dön</button>
          </section>
        </div>
      )}
    </main>
  );
}

function CustomerOrderStatus({
  tableNo,
  refreshKey,
}: {
  tableNo: number;
  refreshKey: number;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch(`/api/orders?table=${tableNo}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          orders?: Order[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Sipariş durumu alınamadı.");
        }
        if (active) {
          setOrders(payload.orders ?? []);
          setError("");
        }
      } catch {
        if (active) setError("Sipariş durumu şu anda yenilenemiyor.");
      }
    };

    loadStatus();
    const timer = window.setInterval(loadStatus, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tableNo, refreshKey]);

  if (!orders.length && !error) return null;

  const tableTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const steps = [
    { status: "new", label: "Alındı" },
    { status: "preparing", label: "Hazırlanıyor" },
    { status: "ready", label: "Hazır" },
    { status: "served", label: "Teslim" },
  ] as const;
  const ranks: Record<Order["status"], number> = {
    new: 0,
    preparing: 1,
    ready: 2,
    served: 3,
    closed: 3,
  };

  return (
    <section className="customer-status-panel" aria-live="polite">
      <header>
        <div>
          <p>CANLI SİPARİŞ TAKİBİ</p>
          <h2>Masa {String(tableNo).padStart(2, "0")} hesabı</h2>
        </div>
        <div className="customer-account-total">
          <span>Güncel hesap</span>
          <strong>{money(tableTotal)}</strong>
        </div>
      </header>
      {error && <p className="customer-status-error">{error}</p>}
      <div className="customer-order-status-list">
        {orders.map((order, orderIndex) => {
          const rank = ranks[order.status];
          return (
            <article className="customer-status-card" key={order.id}>
              <div className="customer-status-head">
                <div>
                  <span>Sipariş {orders.length - orderIndex}</span>
                  <small>#{order.id.slice(0, 6).toUpperCase()}</small>
                </div>
                <div>
                  <strong>{statusText[order.status]}</strong>
                  <small>{money(order.total)}</small>
                </div>
              </div>
              <div className="status-timeline">
                {steps.map((step, index) => (
                  <div
                    className={
                      index < rank ? "done" : index === rank ? "active" : ""
                    }
                    key={step.status}
                  >
                    <i>{index <= rank ? "✓" : ""}</i>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function useLiveOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const payload = (await response.json()) as {
        orders?: Order[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Siparişler alınamadı.");
      setOrders(payload.orders ?? []);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Bağlantı kurulamadı.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, 4000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const updateStatus = async (id: string, status: Order["status"]) => {
    setOrders((current) =>
      status === "closed"
        ? current.filter((order) => order.id !== id)
        : current.map((order) =>
            order.id === id ? { ...order, status } : order,
          ),
    );
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) reload();
  };

  const closeTable = async (tableNo: number) => {
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNo, status: "closed" }),
    });
    if (response.ok) {
      setOrders((current) =>
        current.filter((order) => order.tableNo !== tableNo),
      );
      return true;
    }
    reload();
    return false;
  };

  return {
    orders,
    loading,
    error,
    reload,
    updateStatus,
    closeTable,
  };
}

function ManagementSidebar({
  active,
  onNavigate,
}: {
  active: "cashier" | "kitchen" | "qr";
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="management-sidebar">
      <div className="admin-brand">
        <strong>masa<span>.</span></strong>
        <small>YÖNETİM PANELİ</small>
      </div>
      <nav>
        <button
          className={active === "cashier" ? "active" : ""}
          onClick={() => onNavigate("cashier")}
        >
          <span>▦</span> Canlı siparişler
        </button>
        <button
          className={active === "kitchen" ? "active" : ""}
          onClick={() => onNavigate("kitchen")}
        >
          <span>◫</span> Mutfak ekranı
        </button>
        <button
          className={active === "qr" ? "active" : ""}
          onClick={() => onNavigate("qr")}
        >
          <span>⌗</span> Masa QR kodları
        </button>
        <button onClick={() => onNavigate("menu")}>
          <span>☕</span> Müşteri menüsü
        </button>
      </nav>
      <div className="admin-profile">
        <span>MP</span>
        <div>
          <strong>Masa Personeli</strong>
          <small>Terminal 01 · Çevrimiçi</small>
        </div>
      </div>
    </aside>
  );
}

function CashierScreen({ onNavigate }: { onNavigate: (view: View) => void }) {
  const {
    orders,
    loading,
    error,
    reload,
    updateStatus,
    closeTable,
  } = useLiveOrders();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const operationalOrders = useMemo(
    () => orders.filter((order) => order.status !== "served"),
    [orders],
  );
  const activeTables = new Set(orders.map((order) => order.tableNo)).size;
  const dailyRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const readyCount = orders.filter((order) => order.status === "ready").length;
  const tableAccounts = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const tableNo = index + 1;
        const tableOrders = orders.filter(
          (order) => order.tableNo === tableNo,
        );
        return {
          tableNo,
          orders: tableOrders,
          total: tableOrders.reduce((sum, order) => sum + order.total, 0),
          itemCount: tableOrders.reduce(
            (sum, order) =>
              sum +
              order.items.reduce(
                (itemSum, item) => itemSum + item.quantity,
                0,
              ),
            0,
          ),
          activeStatus:
            tableOrders.find((order) => order.status === "new")?.status ??
            tableOrders.find((order) => order.status === "preparing")?.status ??
            tableOrders.find((order) => order.status === "ready")?.status ??
            tableOrders[0]?.status,
        };
      }),
    [orders],
  );
  const selectedOrders =
    selectedTable === null
      ? []
      : orders.filter((order) => order.tableNo === selectedTable);

  return (
    <main className="management-shell">
      <ManagementSidebar active="cashier" onNavigate={onNavigate} />
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>TERMINAL 01</p>
            <h1>İşletme Özeti</h1>
          </div>
          <div className="admin-top-actions">
            <span className="connection-pill"><i /> Sistem çevrimiçi</span>
            <button onClick={reload} aria-label="Siparişleri yenile">↻</button>
          </div>
        </header>

        <section className="metric-grid" aria-label="İşletme özeti">
          <article>
            <span>AKTİF MASA</span>
            <strong>{activeTables} <small>/ 12</small></strong>
            <i className="metric-icon">▦</i>
          </article>
          <article>
            <span>AÇIK SİPARİŞ</span>
            <strong>{String(operationalOrders.length).padStart(2, "0")}</strong>
            <i className="metric-icon orange">◴</i>
          </article>
          <article>
            <span>AKTİF CİRO</span>
            <strong>{money(dailyRevenue)}</strong>
            <i className="metric-icon green">₺</i>
          </article>
          <article>
            <span>TESLİME HAZIR</span>
            <strong>{String(readyCount).padStart(2, "0")}</strong>
            <i className="metric-icon blue">✓</i>
          </article>
        </section>

        <section className="table-accounts-section">
          <header>
            <div>
              <p>MASA PLANI</p>
              <h2>Masa hesapları</h2>
            </div>
            <span>
              Dolu masaya dokunarak tüm siparişleri ve güncel hesabı görün.
            </span>
          </header>
          <div className="table-account-grid">
            {tableAccounts.map((account) => (
              <button
                className={account.orders.length ? "occupied" : ""}
                key={account.tableNo}
                onClick={() =>
                  account.orders.length && setSelectedTable(account.tableNo)
                }
                disabled={!account.orders.length}
              >
                <div className="table-card-head">
                  <span>Masa</span>
                  <strong>{String(account.tableNo).padStart(2, "0")}</strong>
                  <i className={account.orders.length ? "busy" : ""} />
                </div>
                {account.orders.length ? (
                  <>
                    <div className="table-card-total">
                      <small>Güncel hesap</small>
                      <strong>{money(account.total)}</strong>
                    </div>
                    <div className="table-card-foot">
                      <span>{account.orders.length} sipariş</span>
                      <span>{account.itemCount} ürün</span>
                      <b>
                        {account.activeStatus
                          ? statusText[account.activeStatus]
                          : ""}
                      </b>
                    </div>
                  </>
                ) : (
                  <div className="table-empty-state">
                    <span>Boş masa</span>
                    <small>Henüz açık hesap yok</small>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="live-order-section">
          <header>
            <div>
              <p>CANLI AKIŞ</p>
              <h2>Siparişler</h2>
            </div>
            <div className="order-legend">
              <span><i className="new" /> Yeni</span>
              <span><i className="preparing" /> Hazırlanıyor</span>
              <span><i className="ready" /> Hazır</span>
            </div>
          </header>

          {error && <div className="admin-error">{error}</div>}
          <div className="admin-order-grid" aria-live="polite">
            {!operationalOrders.length && (
              <div className="admin-empty">
                <span>◎</span>
                <strong>
                  {loading
                    ? "Siparişler yükleniyor…"
                    : "Hazırlanacak sipariş yok"}
                </strong>
                <p>Yeni sipariş geldiğinde burada bir işlem kartı açılacak.</p>
              </div>
            )}
            {operationalOrders.map((order) => (
              <article
                className={`admin-order-card status-${order.status}`}
                key={order.id}
              >
                <div className="admin-order-head">
                  <div>
                    <span className={`status-badge ${order.status}`}>
                      {statusText[order.status]}
                    </span>
                    <h3>Masa {String(order.tableNo).padStart(2, "0")}</h3>
                    <small>#{order.id.slice(0, 6).toUpperCase()}</small>
                  </div>
                  <div className="elapsed-block">
                    <strong>{minutesSince(order.createdAt)} dk</strong>
                    <span>{formatTime(order.createdAt)}</span>
                  </div>
                </div>
                <div className="admin-order-items">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      <span><b>{item.quantity}×</b> {item.name}</span>
                      <small>{money(item.price * item.quantity)}</small>
                    </div>
                  ))}
                </div>
                {order.note && <p className="admin-order-note">Not: {order.note}</p>}
                <div className="admin-order-total">
                  <span>Toplam</span>
                  <strong>{money(order.total)}</strong>
                </div>
                <OrderAction order={order} onUpdate={updateStatus} />
              </article>
            ))}
          </div>
        </section>
      </section>
      {selectedTable !== null && selectedOrders.length > 0 && (
        <TableAccountModal
          tableNo={selectedTable}
          orders={selectedOrders}
          onClose={() => setSelectedTable(null)}
          onCloseAccount={async () => {
            const closed = await closeTable(selectedTable);
            if (closed) setSelectedTable(null);
          }}
        />
      )}
    </main>
  );
}

function TableAccountModal({
  tableNo,
  orders,
  onClose,
  onCloseAccount,
}: {
  tableNo: number;
  orders: Order[];
  onClose: () => void;
  onCloseAccount: () => Promise<void>;
}) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const accountTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const itemCount = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + item.quantity,
        0,
      ),
    0,
  );

  return (
    <div className="table-account-backdrop" onClick={onClose}>
      <aside
        className="table-account-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>MASA HESABI</p>
            <h2>Masa {String(tableNo).padStart(2, "0")}</h2>
            <span>
              {orders.length} sipariş · {itemCount} ürün
            </span>
          </div>
          <button onClick={onClose} aria-label="Masa hesabını kapat">×</button>
        </header>

        <div className="table-order-history">
          {orders.map((order, index) => (
            <article key={order.id}>
              <div className="table-history-head">
                <div>
                  <strong>Sipariş {orders.length - index}</strong>
                  <small>
                    {formatTime(order.createdAt)} · #
                    {order.id.slice(0, 6).toUpperCase()}
                  </small>
                </div>
                <span className={`status-badge ${order.status}`}>
                  {statusText[order.status]}
                </span>
              </div>
              <div className="table-history-items">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <span>
                      <b>{item.quantity}×</b> {item.name}
                    </span>
                    <small>{money(item.price * item.quantity)}</small>
                  </div>
                ))}
              </div>
              {order.note && <p>Not: {order.note}</p>}
              <footer>
                <span>Sipariş toplamı</span>
                <strong>{money(order.total)}</strong>
              </footer>
            </article>
          ))}
        </div>

        <div className="table-account-summary">
          <span>Güncel hesap toplamı</span>
          <strong>{money(accountTotal)}</strong>
        </div>

        {!confirmClose ? (
          <button
            className="close-account-button"
            onClick={() => setConfirmClose(true)}
          >
            Hesabı kapat
          </button>
        ) : (
          <div className="close-account-confirm">
            <p>
              Masa {tableNo} hesabı kapatılacak ve yeni müşteri için
              sıfırlanacak.
            </p>
            <div>
              <button onClick={() => setConfirmClose(false)}>Vazgeç</button>
              <button
                disabled={closing}
                onClick={async () => {
                  setClosing(true);
                  await onCloseAccount();
                  setClosing(false);
                }}
              >
                {closing ? "Kapatılıyor…" : "Evet, hesabı kapat"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function OrderAction({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (id: string, status: Order["status"]) => void;
}) {
  if (order.status === "new") {
    return (
      <button
        className="admin-order-action"
        onClick={() => onUpdate(order.id, "preparing")}
      >
        Hazırlamaya başla <span>→</span>
      </button>
    );
  }
  if (order.status === "preparing") {
    return (
      <button
        className="admin-order-action"
        onClick={() => onUpdate(order.id, "ready")}
      >
        Hazır olarak işaretle <span>→</span>
      </button>
    );
  }
  return (
    <button
      className="admin-order-action ready-action"
      onClick={() => onUpdate(order.id, "served")}
    >
      Teslim edildi <span>✓</span>
    </button>
  );
}

function KitchenScreen({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { orders, loading, error, reload, updateStatus } = useLiveOrders();
  const operationalOrders = useMemo(
    () => orders.filter((order) => order.status !== "served"),
    [orders],
  );
  const [clock, setClock] = useState("");

  useEffect(() => {
    const updateClock = () =>
      setClock(
        new Intl.DateTimeFormat("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="kitchen-shell">
      <aside className="kitchen-rail">
        <button className="kitchen-logo" onClick={() => onNavigate("cashier")}>
          masa<span>.</span>
        </button>
        <nav>
          <button className="active" aria-label="Mutfak siparişleri">◫</button>
          <button onClick={() => onNavigate("cashier")} aria-label="Kasa paneli">▦</button>
          <button onClick={() => onNavigate("qr")} aria-label="QR kodları">⌗</button>
          <button onClick={() => onNavigate("menu")} aria-label="Menü">☕</button>
        </nav>
      </aside>
      <section className="kitchen-main">
        <header className="kitchen-header">
          <div>
            <p>MUTFAK OPERASYONU</p>
            <h1>Sipariş Ekranı</h1>
          </div>
          <div className="kitchen-stats">
            <span className="kitchen-online"><i /> Bağlı</span>
            <div><small>AKTİF FİŞ</small><strong>{operationalOrders.length}</strong></div>
            <div><small>ORT. SÜRE</small><strong>12 dk</strong></div>
            <button onClick={reload} aria-label="Siparişleri yenile">↻</button>
          </div>
        </header>

        {error && <div className="kitchen-error">{error}</div>}
        <section className="ticket-board" aria-live="polite">
          {!operationalOrders.length && (
            <div className="kitchen-empty">
              <span>◌</span>
              <h2>{loading ? "Siparişler yükleniyor…" : "Mutfak hazır"}</h2>
              <p>Yeni sipariş geldiğinde burada bir fiş açılacak.</p>
            </div>
          )}
          {operationalOrders.map((order) => (
            <article className={`kitchen-ticket ticket-${order.status}`} key={order.id}>
              <header>
                <div>
                  <h2>M-{String(order.tableNo).padStart(2, "0")}</h2>
                  <span>{statusText[order.status]}</span>
                </div>
                <div>
                  <strong className={minutesSince(order.createdAt) >= 15 ? "late" : ""}>
                    {minutesSince(order.createdAt)} dk
                  </strong>
                  <small>{formatTime(order.createdAt)}</small>
                </div>
              </header>
              <div className="ticket-items">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <strong>{item.quantity}×</strong>
                    <span>{item.name}</span>
                  </div>
                ))}
                {order.note && <p>NOT · {order.note}</p>}
              </div>
              <footer>
                {order.status === "new" && (
                  <button onClick={() => updateStatus(order.id, "preparing")}>
                    <span>♨</span> Hazırlamaya başla
                  </button>
                )}
                {order.status === "preparing" && (
                  <button onClick={() => updateStatus(order.id, "ready")}>
                    <span>✓</span> Hazır
                  </button>
                )}
                {order.status === "ready" && (
                  <button className="waiting" onClick={() => onNavigate("cashier")}>
                    <span>◉</span> Teslim bekliyor
                  </button>
                )}
              </footer>
            </article>
          ))}
        </section>
        <footer className="kitchen-statusbar">
          <div>
            <span>SİSTEM: AKTİF</span>
            <span>YAZICI: ÇEVRİMİÇİ</span>
            <span>MASALAR: SENKRONİZE</span>
          </div>
          <strong>{clock}</strong>
        </footer>
      </section>
    </main>
  );
}

function QrScreen({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [codes, setCodes] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    const createCodes = async () => {
      const entries = await Promise.all(
        Array.from({ length: 12 }, (_, index) => {
          const table = index + 1;
          return QRCode.toDataURL(
            `${window.location.origin}/?table=${table}`,
            {
              margin: 1,
              width: 260,
              color: { dark: "#201f1a", light: "#fffaf0" },
            },
          ).then((dataUrl) => [table, dataUrl] as const);
        }),
      );
      if (active) setCodes(Object.fromEntries(entries));
    };
    createCodes();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="management-shell qr-management-shell">
      <ManagementSidebar active="qr" onNavigate={onNavigate} />
      <section className="qr-main">
        <header className="qr-page-header">
          <div>
            <p>MASA YÖNETİMİ</p>
            <h1>QR Kodları</h1>
            <span>Her kod siparişi otomatik olarak doğru masaya bağlar.</span>
          </div>
          <button onClick={() => onNavigate("cashier")}>← Panele dön</button>
        </header>
        <div className="qr-card-grid">
          {Array.from({ length: 12 }, (_, index) => {
            const table = index + 1;
            return (
              <article className="print-qr-card" key={table}>
                <header>
                  <strong>masa<span>.</span></strong>
                  <small>MASA {String(table).padStart(2, "0")}</small>
                </header>
                <div className="qr-art">
                  {codes[table] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={codes[table]} alt={`Masa ${table} QR kodu`} />
                  ) : (
                    <span>Hazırlanıyor…</span>
                  )}
                </div>
                <h2>Masa {String(table).padStart(2, "0")}</h2>
                <p>Okut · Seç · Sipariş ver</p>
                {codes[table] && (
                  <a href={codes[table]} download={`masa-${table}-qr.png`}>
                    QR kodu indir
                  </a>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatTime(value: string) {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
  if (Number.isNaN(date.getTime())) return "Şimdi";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function minutesSince(value: string) {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}
