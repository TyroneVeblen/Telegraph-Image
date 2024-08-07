export async function onRequestPost(context) {
    // Contents of context object
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;
    context.request;
    const url = new URL(request.url);
    if (decodeURIComponent(params.authCode) === env.AUTH_CODE) {
        const response = fetch("https://telegra.ph/" + url.pathname + url.search, {
            method: request.method,
            headers: request.headers,
            body: request.body,
        });
        response.json().then(data => {
            if (data && data.length > 0 && data[0].src) {
              // 提取文件路径
              const filePath = data[0].src;
              
              // 使用正则表达式提取文件名
              const fileNameMatch = filePath.match(/\/([^\/]+)$/);
              
              if (fileNameMatch && fileNameMatch[1]) {
                const fileName = fileNameMatch[1];
                console.log("File name:", fileName);
                
                // 将文件名存入 KV
                // 注意：这里假设你已经有了一个 KV 命名空间的引用，称为 myKV
                env.img_url.put(fileName,"")
                  .then(() => console.log("File name saved to KV"))
                  .catch(error => console.error("Error saving to KV:", error));
              } else {
                console.log("File name not found in the path");
              }
            } else {
              console.log("Invalid response format");
            }
          }).catch(error => {
            console.error("Error parsing response:", error);
          });
        return response;
    } else {
        return new UnauthorizedException('no auth')
    }
}
function UnauthorizedException(reason) {
    return new Response(reason, {
        status: 401,
        statusText: "Unauthorized",
        headers: {
            "Content-Type": "text/plain;charset=UTF-8",
            // Disables caching by default.
            "Cache-Control": "no-store",
            // Returns the "Content-Length" header for HTTP HEAD requests.
            "Content-Length": reason.length,
        },
    });
}
