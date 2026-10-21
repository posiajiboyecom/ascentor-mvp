-- City groups shown on /community/cities. Lagos is seeded by 20261008_reimagine.sql; these are the other cities
-- from the design. Idempotent. Members join them like any group (rx_group_members).
INSERT INTO public.rx_groups (slug, name, description, dimension, is_city, prompt) VALUES
 ('city-abuja','Abuja','Members in the FCT and nearby.','Community',true,'Who is up for a Saturday co-working session?'),
 ('city-port-harcourt','Port Harcourt','Members in Rivers State.','Community',true,'What are you working on this month?'),
 ('city-ibadan','Ibadan','Members in Oyo State.','Community',true,'Where do you study best in Ibadan?'),
 ('city-accra','Accra','Members in Greater Accra.','Community',true,'Introduce yourself and what you are building.'),
 ('city-nairobi','Nairobi','Members in and around Nairobi.','Community',true,'Introduce yourself and what you are building.'),
 ('city-london','London','Members living in London.','Community',true,'Who is joining the Summit online from here?')
ON CONFLICT (slug) DO NOTHING;
