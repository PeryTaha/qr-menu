"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type MenuItem = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  badge?: string;
  art: string;
  emoji: string;
};

type CartItem = MenuItem & { quantity: number };

type Order = {
  id: string;
  tableNo: number;
  status: "new" | "preparing" | "ready" | "served";
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

type View = "menu" | "cashier" | "qr";

const menuItems: MenuItem[] = [
  {
    id: 1,
    name: "İmza Burger",
    description: "Dana köfte, isli cheddar, karamelize soğan ve ev yapımı sos",
    category: "Burger",
    price: 34500,
    badge: "Çok sevilen",
    art: "sunset",
    emoji: "🍔",
  },
  {
    id: 2,
    name: "Çıtır Tavuk Burger",
    description: "Çıtır tavuk, coleslaw, turşu ve ballı hardal",
    category: "Burger",
    price: 29500,
    art: "cream",
    emoji: "🍗",
  },
  {
    id: 3,
    name: "Füme Etli Pizza",
    description: "Domates sos, mozzarella, füme et ve roka",
    category: "Pizza",
    price: 39000,
    badge: "Şefin seçimi",
    art: "red",
    emoji: "🍕",
  },
  {
    id: 4,
    name: "Akdeniz Salata",
    description: "Mevsim yeşillikleri, ezine peyniri, ceviz ve nar ekşisi",
    category: "Salata",
    price: 24500,
    art: "green",
    emoji: "🥗",
  },
  {
    id: 5,
    name: "Trüflü Patates",
    description: "Parmesan, trüf yağı ve sarımsaklı dip sos",
    category: "Atıştırmalık",
    price: 17500,
    art: "gold",
    emoji: "🍟",
  },
  {
    id: 6,
    name: "San Sebastian",
    description: "Akışkan merkezli cheesecake ve bitter çikolata",
    category: "Tatlı",
    price: 19500,
    art: "cocoa",
    emoji: "🍰",
  },
  {
    id: 7,
    name: "Ev Yapımı Limonata",
    description: "Taze limon, nane ve hafif şeker",
    category: "İçecek",
    price: 9500,
    art: "lemon",
    emoji: "🍋",
  },
  {
    id: 8,
    name: "Cold Brew",
    description: "18 saat soğuk demlenmiş özel seri kahve",
    category: "İçecek",
    price: 12500,
    art: "coffee",
    emoji: "☕",
  },
];

const categories = [
  "Tümü",
  "Burger",
  "Pizza",
  "Salata",
  "Atıştırmalık",
  "Tatlı",
  "İçecek",
];

const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);

const getInitialView = (): View => {
  if (typeof window === "undefined") return "menu";
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "kasa") return "cashier";
  if (view === "qr") return "qr";
  return "menu";
};

export function MenuSystem() {
  const [view, setView] = useState<View>(getInitialView);
  const [tableNo, setTableNo] = useState(7);
  const [category, setCategory] = useState("Tümü");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedTable = Number(params.get("table"));
    if (Number.isInteger(parsedTable) && parsedTable > 0) setTableNo(parsedTable);
  }, []);

  const navigate = (next: View) => {
    const url =
      next === "cashier"
        ? "?view=kasa"
        : next === "qr"
          ? "?view=qr"
          : `?table=${tableNo}`;
    window.history.pushState({}, "", url);
    setView(next);
  };

  const addToCart = (item: MenuItem) => {
    setCart((current) => {
      const match = current.find((cartItem) => cartItem.id === item.id);
      if (match) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }
      return [...current, { ...item, quantity: 1 }];
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
      if (!response.ok) {
        throw new Error(payload.error || "Sipariş gönderilemedi.");
      }
      setConfirmedOrder(payload.id?.slice(0, 6).toUpperCase() ?? "");
      setCart([]);
      setNote("");
      setCartOpen(false);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Sipariş gönderilemedi.",
      );
    } finally {
      setPlacing(false);
    }
  };

  if (view === "cashier") {
    return <CashierScreen onNavigate={navigate} />;
  }

  if (view === "qr") {
    return <QrScreen onNavigate={navigate} />;
  }

  const filteredItems =
    category === "Tümü"
      ? menuItems
      : menuItems.filter((item) => item.category === category);

  return (
    <main className="customer-shell">
      <header className="customer-header">
        <button
          className="wordmark"
          onClick={() => navigate("menu")}
          aria-label="Menü ana sayfa"
        >
          masa<span>.</span>
        </button>
        <div className="header-actions">
          <button className="table-pill" onClick={() => navigate("qr")}>
            <span className="live-dot" />
            Masa {tableNo}
          </button>
          <button className="cashier-link" onClick={() => navigate("cashier")}>
            Kasa ekranı
          </button>
        </div>
      </header>

      <section className="menu-hero">
        <div>
          <p className="eyebrow">HOŞ GELDİNİZ · MASA {tableNo}</p>
          <h1>Masaya gelsin.</h1>
          <p className="hero-copy">
            Canının çektiğini seç, siparişini ver. Gerisini bize bırak.
          </p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-text">TAPTAZE · MUTLU MASALAR · </span>
          <span className="hero-plate">🍔</span>
        </div>
      </section>

      <nav className="category-row" aria-label="Menü kategorileri">
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

      <section className="menu-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BUGÜN NE YİYORUZ?</p>
            <h2>{category === "Tümü" ? "Menüden seç" : category}</h2>
          </div>
          <span>{filteredItems.length} ürün</span>
        </div>
        <div className="menu-grid">
          {filteredItems.map((item) => (
            <article className="menu-card" key={item.id}>
              <div className={`food-art ${item.art}`}>
                {item.badge && (
                  <span className="food-badge">{item.badge}</span>
                )}
                <span className="food-emoji" aria-hidden="true">
                  {item.emoji}
                </span>
              </div>
              <div className="card-content">
                <div>
                  <p className="item-category">{item.category}</p>
                  <h3>{item.name}</h3>
                  <p className="item-description">{item.description}</p>
                </div>
                <div className="card-bottom">
                  <strong>{money(item.price)}</strong>
                  <button
                    className="add-button"
                    onClick={() => addToCart(item)}
                    aria-label={`${item.name} sepete ekle`}
                  >
                    <span>+</span> Ekle
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {cartCount > 0 && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{cartCount}</span>
          <span>Sepeti gör</span>
          <strong>{money(cartTotal)}</strong>
        </button>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-handle" />
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">MASA {tableNo}</p>
                <h2>Siparişin</h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                aria-label="Sepeti kapat"
              >
                ×
              </button>
            </div>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-line" key={item.id}>
                  <span className={`cart-thumb ${item.art}`}>
                    {item.emoji}
                  </span>
                  <div className="cart-name">
                    <strong>{item.name}</strong>
                    <span>{money(item.price)}</span>
                  </div>
                  <div className="quantity-control">
                    <button
                      onClick={() => setQuantity(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => setQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <label className="note-field">
              <span>Sipariş notu</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Örn. Soğansız olsun"
                maxLength={300}
              />
            </label>
            <div className="checkout-total">
              <span>Toplam</span>
              <strong>{money(cartTotal)}</strong>
            </div>
            <button
              className="checkout-button"
              onClick={placeOrder}
              disabled={placing}
            >
              {placing
                ? "Gönderiliyor..."
                : `Siparişi gönder · ${money(cartTotal)}`}
            </button>
            <p className="checkout-note">Sipariş doğrudan kasaya iletilecek.</p>
          </aside>
        </div>
      )}

      {confirmedOrder !== null && (
        <div className="success-overlay">
          <div className="success-card">
            <span className="success-check">✓</span>
            <p className="eyebrow">SİPARİŞ ALINDI</p>
            <h2>Mutfağa ilettik!</h2>
            <p>Masa {tableNo} için siparişiniz hazırlanacak.</p>
            <small>Sipariş #{confirmedOrder}</small>
            <button onClick={() => setConfirmedOrder(null)}>Menüye dön</button>
          </div>
        </div>
      )}
    </main>
  );
}

function CashierScreen({
  onNavigate,
}: {
  onNavigate: (view: View) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const payload = (await response.json()) as {
        orders?: Order[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Siparişler alınamadı.");
      }
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
    loadOrders();
    const timer = window.setInterval(loadOrders, 4000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  const updateStatus = async (id: string, status: Order["status"]) => {
    setOrders((current) =>
      status === "served"
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
    if (!response.ok) loadOrders();
  };

  const grouped = useMemo(
    () => ({
      new: orders.filter((order) => order.status === "new"),
      preparing: orders.filter((order) => order.status === "preparing"),
      ready: orders.filter((order) => order.status === "ready"),
    }),
    [orders],
  );

  return (
    <main className="cashier-shell">
      <aside className="cashier-sidebar">
        <button
          className="wordmark light"
          onClick={() => onNavigate("cashier")}
        >
          masa<span>.</span>
        </button>
        <nav>
          <button className="active">
            <span>▦</span> Siparişler
          </button>
          <button onClick={() => onNavigate("menu")}>
            <span>⌕</span> Müşteri menüsü
          </button>
          <button onClick={() => onNavigate("qr")}>
            <span>⌗</span> QR kodlar
          </button>
        </nav>
        <div className="venue-card">
          <span className="venue-avatar">M</span>
          <div>
            <strong>Masa Bistro</strong>
            <small>Şube açık</small>
          </div>
          <span className="live-dot" />
        </div>
      </aside>
      <section className="cashier-main">
        <header className="cashier-header">
          <div>
            <p className="eyebrow">CANLI OPERASYON</p>
            <h1>Siparişler</h1>
          </div>
          <div className="cashier-actions">
            <span className="sync-state">
              <i /> Canlı
            </span>
            <button onClick={loadOrders} aria-label="Siparişleri yenile">
              ↻
            </button>
          </div>
        </header>

        <div className="summary-strip">
          <div>
            <span>Yeni sipariş</span>
            <strong>{grouped.new.length}</strong>
          </div>
          <div>
            <span>Hazırlanıyor</span>
            <strong>{grouped.preparing.length}</strong>
          </div>
          <div>
            <span>Teslime hazır</span>
            <strong>{grouped.ready.length}</strong>
          </div>
          <div className="summary-highlight">
            <span>Aktif toplam</span>
            <strong>{orders.length}</strong>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="order-board">
          <OrderColumn
            title="Yeni"
            accent="coral"
            orders={grouped.new}
            empty={loading ? "Siparişler yükleniyor..." : "Yeni sipariş yok"}
            actionLabel="Hazırlamaya başla"
            nextStatus="preparing"
            onUpdate={updateStatus}
          />
          <OrderColumn
            title="Hazırlanıyor"
            accent="amber"
            orders={grouped.preparing}
            empty="Hazırlanan sipariş yok"
            actionLabel="Hazır olarak işaretle"
            nextStatus="ready"
            onUpdate={updateStatus}
          />
          <OrderColumn
            title="Hazır"
            accent="mint"
            orders={grouped.ready}
            empty="Teslime hazır sipariş yok"
            actionLabel="Teslim edildi"
            nextStatus="served"
            onUpdate={updateStatus}
          />
        </div>
      </section>
    </main>
  );
}

function OrderColumn({
  title,
  accent,
  orders,
  empty,
  actionLabel,
  nextStatus,
  onUpdate,
}: {
  title: string;
  accent: string;
  orders: Order[];
  empty: string;
  actionLabel: string;
  nextStatus: Order["status"];
  onUpdate: (id: string, status: Order["status"]) => void;
}) {
  return (
    <section className={`order-column ${accent}`}>
      <header>
        <div>
          <span className="column-dot" />
          <h2>{title}</h2>
        </div>
        <strong>{orders.length}</strong>
      </header>
      <div className="order-list">
        {!orders.length && (
          <div className="empty-column">
            <span>◎</span>
            {empty}
          </div>
        )}
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-top">
              <div>
                <span className="table-number">Masa {order.tableNo}</span>
                <small>#{order.id.slice(0, 6).toUpperCase()}</small>
              </div>
              <time>{formatTime(order.createdAt)}</time>
            </div>
            <div className="order-items">
              {order.items.map((item) => (
                <div key={item.id}>
                  <strong>{item.quantity}×</strong>
                  <span>{item.name}</span>
                  <small>{money(item.price * item.quantity)}</small>
                </div>
              ))}
            </div>
            {order.note && <p className="order-note">“{order.note}”</p>}
            <div className="order-total">
              <span>Toplam</span>
              <strong>{money(order.total)}</strong>
            </div>
            <button
              className="order-action"
              onClick={() => onUpdate(order.id, nextStatus)}
            >
              {actionLabel} <span>→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function QrScreen({
  onNavigate,
}: {
  onNavigate: (view: View) => void;
}) {
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
              width: 240,
              color: { dark: "#18201d", light: "#fffdf7" },
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
    <main className="qr-shell">
      <header className="qr-header">
        <div>
          <button className="wordmark" onClick={() => onNavigate("menu")}>
            masa<span>.</span>
          </button>
          <div>
            <p className="eyebrow">MASAYA ÖZEL</p>
            <h1>QR Kodlar</h1>
            <p>Her masanın kodu siparişi doğru masaya bağlar.</p>
          </div>
        </div>
        <button
          className="back-to-cashier"
          onClick={() => onNavigate("cashier")}
        >
          ← Kasa ekranı
        </button>
      </header>
      <section className="qr-grid">
        {Array.from({ length: 12 }, (_, index) => {
          const table = index + 1;
          return (
            <article className="qr-card" key={table}>
              <div className="qr-card-top">
                <span>masa.</span>
                <small>MASA {String(table).padStart(2, "0")}</small>
              </div>
              <div className="qr-image-wrap">
                {codes[table] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={codes[table]} alt={`Masa ${table} QR kodu`} />
                ) : (
                  <span className="qr-loading">Hazırlanıyor</span>
                )}
              </div>
              <h2>Masa {table}</h2>
              <p>Okut, seç, sipariş ver.</p>
              {codes[table] && (
                <a href={codes[table]} download={`masa-${table}-qr.png`}>
                  QR kodu indir
                </a>
              )}
            </article>
          );
        })}
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
