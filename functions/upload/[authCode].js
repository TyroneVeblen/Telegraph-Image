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
        const response = await fetch("https://telegra.ph/" + url.pathname + url.search, {
            method: request.method,
            headers: request.headers,
            body: request.body,
        })
        const responseData = await response.json();
        let file = responseData[0].src.replace("/file/", "")
        if (
            typeof env.img_url == "undefined" ||
            env.img_url == null ||
            env.img_url == ""
        ) { console.log("No KV bound, skipped") } else {
            const put_KV = await env.img_url.put(file, "")
            console.log(put_KV)
        }
        return new Response(JSON.stringify(responseData), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
        // return response
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
