const sampleFishImages = {
  tuna: '/images/tuna-photo.jpg',
  pomfret: '/images/pomfret-photo.jpg',
  kingfish: '/images/kingfish-photo.jpg',
  'king fish': '/images/kingfish-photo.jpg',
  bangus: '/images/bangus-photo.jpg',
  'seer fish': '/images/seer-fish-photo.jpg'
};

export function sampleImageForFishType(fishType) {
  return sampleFishImages[String(fishType || '').trim().toLowerCase()] || '';
}

export function sampleImageFor(item) {
  return item?.imageUrl || sampleImageForFishType(item?.fishType);
}
