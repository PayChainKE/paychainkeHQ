// Real sub-county divisions (constituencies) for each of Kenya's 47
// counties — used to validate that a merchant's self-reported
// Area/Location at signup is an actual place inside the county they
// selected, not an arbitrary string (previously nothing stopped a
// mismatched or made-up value; see merchantAuthController.js#registerMerchant).
// Constituency level was chosen deliberately: it's the real, official,
// fixed administrative layer one step below county (per IEBC/Wikipedia),
// granular enough to mean something ("Westlands" rather than just
// "Nairobi") without requiring the ~1,450-ward-level precision no merchant
// would reliably know for their own business anyway.
//
// Keys must exactly match KENYAN_COUNTIES in
// apps/merchant-dashboard/src/pages/Login.jsx and
// apps/mobile-app/src/pages/Login.tsx (47 counties, kept in sync per those
// files' own comments) — same convention as kenyaCountyCentroids.js.
export const KENYA_COUNTY_AREAS = {
  'Baringo': ['Tiaty', 'Baringo North', 'Baringo Central', 'Baringo South', 'Mogotio', 'Eldama Ravine'],
  'Bomet': ['Sotik', 'Chepalungu', 'Bomet East', 'Bomet Central', 'Konoin'],
  'Bungoma': ['Mount Elgon', 'Sirisia', 'Kabuchai', 'Bumula', 'Kanduyi', 'Webuye East', 'Webuye West', 'Kimilili', 'Tongaren'],
  'Busia': ['Teso North', 'Teso South', 'Nambale', 'Matayos', 'Butula', 'Funyula', 'Budalangi'],
  'Elgeyo-Marakwet': ['Marakwet East', 'Marakwet West', 'Keiyo North', 'Keiyo South'],
  'Embu': ['Manyatta', 'Runyenjes', 'Mbeere South', 'Mbeere North'],
  'Garissa': ['Garissa Township', 'Balambala', 'Lagdera', 'Dadaab', 'Fafi', 'Ijara'],
  'Homa Bay': ['Kasipul', 'Kabondo Kasipul', 'Karachuonyo', 'Rangwe', 'Homa Bay Town', 'Ndhiwa', 'Suba North', 'Suba South'],
  'Isiolo': ['Isiolo North', 'Isiolo South'],
  'Kajiado': ['Kajiado North', 'Kajiado Central', 'Kajiado East', 'Kajiado West', 'Kajiado South'],
  'Kakamega': ['Lugari', 'Likuyani', 'Malava', 'Lurambi', 'Navakholo', 'Mumias West', 'Mumias East', 'Matungu', 'Butere', 'Khwisero', 'Shinyalu', 'Ikolomani'],
  'Kericho': ['Kipkelion East', 'Kipkelion West', 'Ainamoi', 'Bureti', 'Belgut', 'Sigowet-Soin'],
  'Kiambu': ['Gatundu South', 'Gatundu North', 'Juja', 'Thika Town', 'Ruiru', 'Githunguri', 'Kiambu', 'Kiambaa', 'Kabete', 'Kikuyu', 'Limuru', 'Lari'],
  'Kilifi': ['Kilifi North', 'Kilifi South', 'Kaloleni', 'Rabai', 'Ganze', 'Malindi', 'Magarini'],
  'Kirinyaga': ['Mwea', 'Gichugu', 'Ndia', 'Kirinyaga Central'],
  'Kisii': ['Bonchari', 'South Mugirango', 'Bomachoge Borabu', 'Bobasi', 'Bomachoge Chache', 'Nyaribari Masaba', 'Nyaribari Chache', 'Kitutu Chache North', 'Kitutu Chache South'],
  'Kisumu': ['Kisumu East', 'Kisumu West', 'Kisumu Central', 'Seme', 'Nyando', 'Muhoroni', 'Nyakach'],
  'Kitui': ['Mwingi North', 'Mwingi West', 'Mwingi Central', 'Kitui West', 'Kitui Rural', 'Kitui Central', 'Kitui East', 'Kitui South'],
  'Kwale': ['Msambweni', 'Lunga Lunga', 'Matuga', 'Kinango'],
  'Laikipia': ['Laikipia West', 'Laikipia East', 'Laikipia North'],
  'Lamu': ['Lamu East', 'Lamu West'],
  'Machakos': ['Masinga', 'Yatta', 'Kangundo', 'Matungulu', 'Kathiani', 'Mavoko', 'Machakos Town', 'Mwala'],
  'Makueni': ['Mbooni', 'Kilome', 'Kaiti', 'Makueni', 'Kibwezi West', 'Kibwezi East'],
  'Mandera': ['Mandera West', 'Banissa', 'Mandera North', 'Mandera South', 'Mandera East', 'Lafey'],
  'Marsabit': ['Moyale', 'North Horr', 'Saku', 'Laisamis'],
  'Meru': ['Igembe South', 'Igembe Central', 'Igembe North', 'Tigania West', 'Tigania East', 'North Imenti', 'Buuri', 'Central Imenti', 'South Imenti'],
  'Migori': ['Rongo', 'Awendo', 'Suna East', 'Suna West', 'Uriri', 'Nyatike', 'Kuria West', 'Kuria East'],
  'Mombasa': ['Changamwe', 'Jomvu', 'Kisauni', 'Nyali', 'Likoni', 'Mvita'],
  "Murang'a": ['Kangema', 'Mathioya', 'Kiharu', 'Kigumo', 'Maragwa', 'Kandara', 'Gatanga'],
  'Nairobi': ['Westlands', 'Dagoretti North', 'Dagoretti South', "Lang'ata", 'Kibra', 'Roysambu', 'Kasarani', 'Ruaraka', 'Embakasi South', 'Embakasi North', 'Embakasi Central', 'Embakasi East', 'Embakasi West', 'Makadara', 'Kamukunji', 'Starehe', 'Mathare'],
  'Nakuru': ['Molo', 'Njoro', 'Naivasha', 'Gilgil', 'Kuresoi South', 'Kuresoi North', 'Subukia', 'Rongai', 'Bahati', 'Nakuru Town West', 'Nakuru Town East'],
  'Nandi': ['Tinderet', 'Aldai', 'Nandi Hills', 'Chesumei', 'Emgwen', 'Mosop'],
  'Narok': ['Kilgoris', 'Emurua Dikirr', 'Narok North', 'Narok East', 'Narok South', 'Narok West'],
  'Nyamira': ['Kitutu Masaba', 'West Mugirango', 'North Mugirango', 'Borabu'],
  'Nyandarua': ['Kinangop', 'Kipipiri', 'Ol Kalou', 'Ol Jorok', 'Ndaragwa'],
  'Nyeri': ['Tetu', 'Kieni', 'Mathira', 'Othaya', 'Mukurweini', 'Nyeri Town'],
  'Samburu': ['Samburu West', 'Samburu North', 'Samburu East'],
  'Siaya': ['Ugenya', 'Ugunja', 'Alego Usonga', 'Gem', 'Bondo', 'Rarieda'],
  'Taita-Taveta': ['Taveta', 'Wundanyi', 'Mwatate', 'Voi'],
  'Tana River': ['Garsen', 'Galole', 'Bura'],
  'Tharaka-Nithi': ['Maara', "Chuka/Igambang'ombe", 'Tharaka'],
  'Trans Nzoia': ['Kwanza', 'Endebess', 'Saboti', 'Kiminini', 'Cherangany'],
  'Turkana': ['Turkana North', 'Turkana West', 'Turkana Central', 'Loima', 'Turkana South', 'Turkana East'],
  'Uasin Gishu': ['Soy', 'Turbo', 'Moiben', 'Ainabkoi', 'Kapseret', 'Kesses'],
  'Vihiga': ['Vihiga', 'Sabatia', 'Hamisi', 'Luanda', 'Emuhaya'],
  'Wajir': ['Wajir North', 'Wajir East', 'Tarbaj', 'Wajir West', 'Eldas', 'Wajir South'],
  'West Pokot': ['Kapenguria', 'Sigor', 'Kacheliba', 'Pokot South'],
};
