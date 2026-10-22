import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-pin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = neon(process.env.DATABASE_URL);
  const correctPin = process.env.ADMIN_PIN || '1992657';

  // جلب المنتجات (متاح للجميع)
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM products ORDER BY id DESC`;
      return res.status(200).json(rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // التحقق من رمز PIN للإدارة
  const clientPin = req.headers['x-admin-pin'];
  if (clientPin !== correctPin) {
    return res.status(401).json({ error: 'رمز الـ PIN غير صحيح' });
  }

  // إضافة قطعة جديدة
  if (req.method === 'POST') {
    try {
      const { name, price, old_price, category, image_url, colors, sizes, is_discount, is_sold_out } = req.body;
      const result = await sql`
        INSERT INTO products (name, price, old_price, category, image_url, colors, sizes, is_discount, is_sold_out)
        VALUES (${name}, ${price}, ${old_price || null}, ${category}, ${image_url}, ${colors || ''}, ${sizes || ''}, ${Boolean(is_discount)}, ${Boolean(is_sold_out)})
        RETURNING *
      `;
      return res.status(201).json(result[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // تعديل القطعة أو الحالات
  if (req.method === 'PUT') {
    try {
      const b = req.body;
      if (b.action === 'toggle_sold_out') {
        await sql`UPDATE products SET is_sold_out = ${Boolean(b.is_sold_out)} WHERE id = ${b.id}`;
        return res.status(200).json({ success: true });
      }
      if (b.action === 'toggle_discount') {
        await sql`UPDATE products SET is_discount = ${Boolean(b.is_discount)}, old_price = ${b.old_price || null} WHERE id = ${b.id}`;
        return res.status(200).json({ success: true });
      }
      if (b.action === 'disable_all_discounts') {
        await sql`UPDATE products SET is_discount = false`;
        return res.status(200).json({ success: true });
      }
      
      await sql`
        UPDATE products 
        SET name = ${b.name}, price = ${b.price}, old_price = ${b.old_price || null}, 
            category = ${b.category}, image_url = ${b.image_url}, colors = ${b.colors || ''}, 
            sizes = ${b.sizes || ''}, is_discount = ${Boolean(b.is_discount)}, is_sold_out = ${Boolean(b.is_sold_out)}
        WHERE id = ${b.id}
      `;
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // حذف قطعة
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || req.body?.id;
      await sql`DELETE FROM products WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
