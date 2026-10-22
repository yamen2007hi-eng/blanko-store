import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ADMIN_PIN = '1992657';
  const sql = neon(process.env.DATABASE_URL);

  // جلب المنتجات
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM products ORDER BY id DESC;`;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // التحقق من رمز الـ PIN للإدارة
  const clientPin = req.headers['x-admin-pin'] || req.body?.admin_pin || req.body?.pin || req.query?.admin_pin;
  if (String(clientPin).trim() !== ADMIN_PIN) {
    return res.status(401).json({ error: 'رمز الـ PIN غير صحيح' });
  }

  // إضافة منتج جديد
  if (req.method === 'POST') {
    const p = req.body;
    try {
      await sql`
        INSERT INTO products (id, name, price, old_price, category, image_url, colors, sizes, is_discount, is_sold_out)
        VALUES (${p.id}, ${p.name}, ${p.price}, ${p.old_price || null}, ${p.category}, ${p.image_url}, ${p.colors || ''}, ${p.sizes || ''}, ${p.is_discount || false}, ${p.is_sold_out || false})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          old_price = EXCLUDED.old_price,
          category = EXCLUDED.category,
          image_url = EXCLUDED.image_url,
          colors = EXCLUDED.colors,
          sizes = EXCLUDED.sizes,
          is_discount = EXCLUDED.is_discount,
          is_sold_out = EXCLUDED.is_sold_out;
      `;
      return res.status(200).json({ success: true, item: p });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // التعديل وتغيير الحالات (PUT)
  if (req.method === 'PUT') {
    const p = req.body;
    const prodId = p.id;

    try {
      if (p.action === 'toggle_sold_out') {
        await sql`UPDATE products SET is_sold_out = ${Boolean(p.is_sold_out)} WHERE id = ${prodId};`;
      } else if (p.action === 'toggle_discount') {
        const hasDisc = Boolean(p.is_discount);
        const oldP = p.old_price ? Number(p.old_price) : null;
        await sql`UPDATE products SET is_discount = ${hasDisc}, old_price = ${oldP} WHERE id = ${prodId};`;
      } else if (p.action === 'disable_all_discounts') {
        await sql`UPDATE products SET is_discount = FALSE;`;
      } else {
        // تعديل بيانات المنتج الكاملة
        await sql`
          UPDATE products SET
            name = ${p.name},
            price = ${p.price},
            old_price = ${p.old_price || null},
            category = ${p.category},
            image_url = ${p.image_url},
            colors = ${p.colors || ''},
            sizes = ${p.sizes || ''},
            is_discount = ${Boolean(p.is_discount)},
            is_sold_out = ${Boolean(p.is_sold_out)}
          WHERE id = ${prodId};
        `;
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('Update error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // حذف منتج
  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id;
    try {
      await sql`DELETE FROM products WHERE id = ${id};`;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
