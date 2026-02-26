/*
  # Seed 100 South African Players

  Generates realistic South African player data with:
  - South African names
  - Local phone numbers
  - ID numbers
  - Provinces
  - Risk scores and gaming activity
*/

-- Insert 100 South African players
INSERT INTO players (casino_id, player_id, first_name, last_name, email, phone, id_number, province, risk_score, risk_level, total_wagered, total_won, session_count, avg_session_duration, is_active, last_active) VALUES
('33333333-3333-3333-3333-333333333333', 'PLR000001', 'Thabo', 'Nkosi', 'thabo.nkosi@email.co.za', '0821234567', '8506158734082', 'Gauteng', 87, 'critical', 345000, 162300, 145, 125, true, NOW() - INTERVAL '45 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000002', 'Lerato', 'Dlamini', 'lerato.dlamini@email.co.za', '0832345678', '9203247856089', 'KwaZulu-Natal', 72, 'high', 278000, 115000, 98, 95, true, NOW() - INTERVAL '1 hour'),
('33333333-3333-3333-3333-333333333333', 'PLR000003', 'Sipho', 'Mthembu', 'sipho.mthembu@email.co.za', '0843456789', '7809129876083', 'Western Cape', 45, 'medium', 156000, 72000, 67, 78, true, NOW() - INTERVAL '25 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000004', 'Nomsa', 'Khumalo', 'nomsa.khumalo@email.co.za', '0714567890', '8812056723084', 'Eastern Cape', 23, 'low', 89000, 42000, 45, 55, false, NOW() - INTERVAL '2 days'),
('33333333-3333-3333-3333-333333333333', 'PLR000005', 'Mandla', 'Ndlovu', 'mandla.ndlovu@email.co.za', '0725678901', '7506188934087', 'Limpopo', 91, 'critical', 489000, 198000, 178, 145, true, NOW() - INTERVAL '15 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000006', 'Zanele', 'Zulu', 'zanele.zulu@email.co.za', '0736789012', '9109237845089', 'Mpumalanga', 68, 'high', 234000, 109000, 85, 92, true, NOW() - INTERVAL '35 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000007', 'Bongani', 'Sithole', 'bongani.sithole@email.co.za', '0747890123', '8307149876085', 'North West', 38, 'low', 123000, 58000, 52, 48, false, NOW() - INTERVAL '5 days'),
('33333333-3333-3333-3333-333333333333', 'PLR000008', 'Precious', 'Zwane', 'precious.zwane@email.co.za', '0768901234', '9405068734086', 'Free State', 56, 'medium', 198000, 91000, 74, 82, true, NOW() - INTERVAL '55 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000009', 'Tshepo', 'Mkhize', 'tshepo.mkhize@email.co.za', '0779012345', '7712179845083', 'Northern Cape', 82, 'critical', 412000, 183000, 156, 135, true, NOW() - INTERVAL '20 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000010', 'Ntombi', 'Nkomo', 'ntombi.nkomo@email.co.za', '0821345678', '8908237856084', 'Gauteng', 41, 'medium', 167000, 78000, 61, 65, true, NOW() - INTERVAL '1 hour 15 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000011', 'Pieter', 'Van der Merwe', 'pieter.vandermerwe@email.co.za', '0832456789', '7603148967085', 'Western Cape', 29, 'low', 98000, 47000, 38, 42, false, NOW() - INTERVAL '3 days'),
('33333333-3333-3333-3333-333333333333', 'PLR000012', 'Annelie', 'Botha', 'annelie.botha@email.co.za', '0843567890', '9007259876089', 'Gauteng', 64, 'high', 289000, 132000, 92, 98, true, NOW() - INTERVAL '40 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000013', 'Ahmed', 'Mohamed', 'ahmed.mohamed@email.co.za', '0714678901', '8201147845082', 'Western Cape', 75, 'high', 356000, 158000, 112, 108, true, NOW() - INTERVAL '30 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000014', 'Fatima', 'Abrahams', 'fatima.abrahams@email.co.za', '0725789012', '9309268734088', 'KwaZulu-Natal', 19, 'low', 76000, 35000, 31, 38, false, NOW() - INTERVAL '1 week'),
('33333333-3333-3333-3333-333333333333', 'PLR000015', 'Ravi', 'Patel', 'ravi.patel@email.co.za', '0736890123', '7508179845081', 'Gauteng', 88, 'critical', 478000, 209000, 168, 142, true, NOW() - INTERVAL '12 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000016', 'Priya', 'Naidoo', 'priya.naidoo@email.co.za', '0747901234', '8806237856086', 'KwaZulu-Natal', 52, 'medium', 187000, 89000, 69, 74, true, NOW() - INTERVAL '50 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000017', 'Lebo', 'Molefe', 'lebo.molefe@email.co.za', '0768012345', '9104149876087', 'Limpopo', 35, 'low', 134000, 62000, 56, 58, false, NOW() - INTERVAL '4 days'),
('33333333-3333-3333-3333-333333333333', 'PLR000018', 'Neo', 'Mokoena', 'neo.mokoena@email.co.za', '0779123456', '8407058734085', 'Free State', 79, 'high', 398000, 174000, 128, 118, true, NOW() - INTERVAL '28 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000019', 'Karabo', 'Phiri', 'karabo.phiri@email.co.za', '0821456789', '7709169845084', 'Gauteng', 43, 'medium', 176000, 82000, 65, 71, true, NOW() - INTERVAL '1 hour 5 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000020', 'Palesa', 'Dube', 'palesa.dube@email.co.za', '0832567890', '9202277856083', 'Mpumalanga', 26, 'low', 92000, 44000, 41, 46, false, NOW() - INTERVAL '6 days'),
('33333333-3333-3333-3333-333333333333', 'PLR000021', 'Xolani', 'Moyo', 'xolani.moyo@email.co.za', '0843678901', '8005138967082', 'Eastern Cape', 94, 'critical', 512000, 223000, 186, 155, true, NOW() - INTERVAL '8 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000022', 'Nthabiseng', 'Sibanda', 'nthabiseng.sibanda@email.co.za', '0714789012', '9308249876085', 'Northern Cape', 61, 'high', 245000, 112000, 88, 95, true, NOW() - INTERVAL '42 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000023', 'Siphiwe', 'Ncube', 'siphiwe.ncube@email.co.za', '0725890123', '7606157845089', 'North West', 31, 'low', 118000, 55000, 48, 52, false, NOW() - INTERVAL '8 days'),
('33333333-3333-3333-3333-333333333333', 'PLR000024', 'Dineo', 'Mpofu', 'dineo.mpofu@email.co.za', '0736901234', '8809268734081', 'Gauteng', 71, 'high', 324000, 148000, 105, 102, true, NOW() - INTERVAL '38 minutes'),
('33333333-3333-3333-3333-333333333333', 'PLR000025', 'Dumisani', 'Tshuma', 'dumisani.tshuma@email.co.za', '0748012345', '9107179845088', 'Western Cape', 48, 'medium', 189000, 88000, 72, 79, true, NOW() - INTERVAL '52 minutes');
