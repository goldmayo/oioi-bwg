export const handler = async () => {
  const url = process.env.TARGET_URL;
  if (!url) {
    console.log("No TARGET_URL defined, skipping warming.");
    return;
  }

  try {
    console.log(`Warming up: ${url}`);
    const start = Date.now();
    // 람다가 잠들지 않도록 메인 페이지를 살짝 찌릅니다.
    const res = await fetch(url);
    const time = Date.now() - start;
    
    console.log(`Warmed successfully. Status: ${res.status}, Time: ${time}ms`);
  } catch (error) {
    console.error(`Warming failed:`, error);
  }
};
