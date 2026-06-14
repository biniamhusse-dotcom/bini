INSERT INTO product_product (product_tmpl_id, uuid, create_uid, write_uid, create_date, write_date)
SELECT pt.id, pt.uuid, 2, 2, NOW(), NOW()
FROM product_template pt
WHERE pt.uuid IN ('7d6de7c6-9f9c-4c6e-a731-8243d1203f38', '9cf86dd2-7390-43ad-b244-a875c6ba7fd2', '10f536ef-4f6e-4119-a70e-a1a5de8942b3')
AND NOT EXISTS (SELECT 1 FROM product_product pp WHERE pp.uuid = pt.uuid);
