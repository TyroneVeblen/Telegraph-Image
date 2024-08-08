export async function onRequest(context) {
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
    const file_name = url.pathname.replace("/file/", "")
    // 未经许可的访问（例如，在telegraph中直接上传文件，然后将URL的主机名变造为任意使用Telegraph-Image作为网站框架的主机名，这在原版本中被允许直接访问）现在不会返回图片，而是返回“Unauthorized access!”（没有绑定KV时失效）
    if (
        typeof env.img_url == "undefined" ||
        env.img_url == null ||
        env.img_url == ""
    ) {
        console.log("No KV bound, skipped")
    } else {
        const value = await env.img_url.get(file_name);
        if (value === null) {
            return new Response("Unauthorized access!", { status: 404 });
        }
    }


    // 视频访问现已通过直接await response获取完整视频后转发（telegraph仅支持不到5MB的视频，所以理论上很快）来解决可能的视频播放问题，但可能导致cpu时间上升。仅支持mp4
    if (url.pathname.endsWith(".mp4")) {
        const telegraphUrl = new URL(url.pathname + url.search, 'https://telegra.ph')
        const telegraphResponse = await fetch(telegraphUrl)
        const responseBody = await telegraphResponse.arrayBuffer()

        const newResponse = new Response(responseBody, {
            status: telegraphResponse.status,
            statusText: telegraphResponse.statusText,
            headers: telegraphResponse.headers
        })

        const contentDisposition = telegraphResponse.headers.get('Content-Disposition')
        if (contentDisposition) {
            newResponse.headers.set('Content-Disposition', contentDisposition.replace('attachment', 'inline'))
        }

        newResponse.headers.set('Access-Control-Allow-Origin', '*')
        return newResponse
    } else {
        const response = fetch("https://telegra.ph/" + url.pathname + url.search, {
            method: request.method,
            headers: request.headers,
            body: request.body,
        }).then(async (response) => {
            console.log(response.ok); // true if the response status is 2xx
            console.log(response.status); // 200
            // fix: 304 not modified ListType Block can be displayed
            if (response.ok || (!response.ok && response.status === 304)) {
                // Referer header equal to the admin page
                console.log(url.origin + "/admin");
                if (request.headers.get("Referer") == url.origin + "/admin") {
                    //show the image
                    return response;
                }

                if (
                    typeof env.img_url == "undefined" ||
                    env.img_url == null ||
                    env.img_url == ""
                ) {
                } else {
                    //check the record from kv
                    const record = await env.img_url.getWithMetadata(params.id);
                    console.log("record");
                    console.log(record);
                    if (record.metadata === null) {
                    } else {
                        //if the record is not null, redirect to the image
                        if (record.metadata.ListType == "White") {
                            return response;
                        } else if (record.metadata.ListType == "Block") {
                            console.log("Referer");
                            console.log(request.headers.get("Referer"));
                            if (
                                typeof request.headers.get("Referer") == "undefined" ||
                                request.headers.get("Referer") == null ||
                                request.headers.get("Referer") == ""
                            ) {
                                console.log(
                                    'url.origin+"/block-img.html"',
                                    url.origin + "/block-img.html"
                                );
                                return Response.redirect(url.origin + "/block-img.html", 302);
                            } else {
                                return Response.redirect(
                                    "https://static-res.pages.dev/teleimage/img-block-compressed.png",
                                    302
                                );
                            }
                        } else if (record.metadata.Label == "adult") {
                            if (
                                typeof request.headers.get("Referer") == "undefined" ||
                                request.headers.get("Referer") == null ||
                                request.headers.get("Referer") == ""
                            ) {
                                return Response.redirect(url.origin + "/block-img.html", 302);
                            } else {
                                return Response.redirect(
                                    "https://static-res.pages.dev/teleimage/img-block-compressed.png",
                                    302
                                );
                            }
                        }
                        //check if the env variables WhiteList_Mode are set
                        console.log("env.WhiteList_Mode:", env.WhiteList_Mode);
                        if (env.WhiteList_Mode == "true") {
                            //if the env variables WhiteList_Mode are set, redirect to the image
                            return Response.redirect(url.origin + "/whitelist-on.html", 302);
                        } else {
                            //if the env variables WhiteList_Mode are not set, redirect to the image
                            return response;
                        }
                    }
                }

                //get time
                let time = new Date().getTime();

                let apikey = env.ModerateContentApiKey;

                if (typeof apikey == "undefined" || apikey == null || apikey == "") {
                    if (
                        typeof env.img_url == "undefined" ||
                        env.img_url == null ||
                        env.img_url == ""
                    ) {
                        console.log("Not enbaled KV");
                    } else {
                        //add image to kv
                        await env.img_url.put(params.id, "", {
                            metadata: { ListType: "None", Label: "None", TimeStamp: time },
                        });
                    }
                } else {
                    await fetch(
                        `https://api.moderatecontent.com/moderate/?key=` +
                        apikey +
                        `&url=https://telegra.ph/` +
                        url.pathname +
                        url.search
                    ).then(async (response) => {
                        let moderate_data = await response.json();
                        console.log(moderate_data);
                        console.log("---env.img_url---");
                        console.log(env.img_url == "true");
                        if (
                            typeof env.img_url == "undefined" ||
                            env.img_url == null ||
                            env.img_url == ""
                        ) {
                        } else {
                            //add image to kv
                            await env.img_url.put(params.id, "", {
                                metadata: {
                                    ListType: "None",
                                    Label: moderate_data.rating_label,
                                    TimeStamp: time,
                                },
                            });
                        }
                        if (moderate_data.rating_label == "adult") {
                            return Response.redirect(url.origin + "/block-img.html", 302);
                        }
                    });
                }
            }
            return response;
        });

        return response;
    }

}
