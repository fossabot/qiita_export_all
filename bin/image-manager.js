"use strict";

require("isomorphic-fetch");
const fse = require("fs-extra");
const path = require("path");

const identifierForItem = "item";

class ImageManager {
    /**
     * 
     * @param {string} imageDirectoryPathFromRootDirectry image directory path from root directory
     */
    constructor(imageDirectoryPathFromRootDirectry) {
        this.imagePathMap_ = {};
        this.imageCachePromise_ = [];
        this.registerdImageURLs_ = new Set();
        this.imageListMap = {};
        this.imageDirectoryPath = imageDirectoryPathFromRootDirectry;
    }
    /**
     * wait all registered image download
     */
    async WaitImageCachePromise() {
        await Promise.all(this.imageCachePromise_);
    }
    /**
     * convert image url to saved relative image path from current directory
     * @param {string} imageUrl image url to download and cache
     */
    ConvertImgUrlToImgPath_(imageUrl) {
        return path.normalize(
            imageUrl.replace(new RegExp("https://camo.qiitausercontent.com"), this.imageDirectoryPath)
        );
    }
    /**
     * notify to cache image
     * @param {string} imageUrl image url to download and cache
     */
    NotifyCacheImage_(imageUrl) {
        if(this.registerdImageURLs_.has(imageUrl)) return;
        this.registerdImageURLs_.add(imageUrl);
        const imagePath = this.ConvertImgUrlToImgPath_(imageUrl);
        this.imageCachePromise_.push(fetch(imageUrl).then(async response => {
            //isomorphic-fetch doesn't support Blob (ref: https://github.com/matthew-andrews/isomorphic-fetch/issues/81).
            // await fse.writeFile(imagePath, await response.blob());
            //Response.buffer() is Node.js extension
            await fse.writeFile(imagePath, await response.buffer());
            this.imagePathMap_[imageUrl] = imagePath;
        }));
    }
        /**
     * Extract Images from HTML string and register to cache
     * @param {string} itemId item id
     * @param {string} identifier identifier
     * @param {string} htmlStr HTML string
     */
    RegisterImagesFromHtml_(itemId, identifier, htmlStr) {
        const imageUrls = htmlStr.match(/img[^>]* src="[^"]+"/g).map(m => m.match(/img[^>]* src="([^"]+)"/)[1]);
        if(0 === imageUrls.length) return;
        /**@type {Set<string>} */
        const imageList = this.imageListMap[itemId][identifier] || new Set();
        for(const imageUrl of imageUrls) {
            this.NotifyCacheImage_(imageUrl);
            imageList.add(imageUrl);
        }
        if(0 !== imageList.size) this.imageListMap[itemId][identifier] = imageList;
    }

    /**
     * Extract Images from HTML string and register to cache
     * @param {string} itemId item id
     * @param {string} htmlStr HTML string
     */
    RegisterImagesFromItemHtml(itemId, htmlStr) {
        this.RegisterImagesFromHtml_(itemId, identifierForItem, htmlStr);
    }
    /**
     * Extract Images from HTML string and register to cache
     * @param {string} itemId item id
     * @param {string} commentId comment id
     * @param {string} htmlStr HTML string
     */
    RegisterImagesFromCommentHtml(itemId, commentId, htmlStr) {
        this.RegisterImagesFromHtml_(itemId, commentId, htmlStr);
    }
    /**
     * Replace URL to image path
     * @param {string} relativeFilePath target file relaive path from workroot directory
     * @param {string} itemId item id
     * @param {string} identifier identifier
     * @param {string} str target string
     */
    ResolveImagePath_(relativeFilePath, itemId, identifier, str) {
        /**@type {Set<string>} */
        const imageList = this.imageListMap[itemId][identifier];
        let tmpArr = [];
        // TODO: rewrite to make simple
        for(const v of imageList.values()) tmpArr.push(v);
        const rx = new RegExp(`(${tmpArr.join("|")})`, "g");
        return str.replace(rx, (_, url) => {
            try{
                return path.normalize(relativeFilePath + this.imagePathMap_[url]);
            }
            catch(_){
                return "";
            }
        })
    }
    /**
     * Replace URL to image path
     * @param {string} relativeFilePath target file relaive path from workroot directory
     * @param {string} itemId item id
     * @param {string} str target string
     */
    ResolveItemImagePath(relativeFilePath, itemId, str) {
        return this.ResolveImagePath_(relativeFilePath, itemId, identifierForItem, str);
    }
    /**
     * Replace URL to image path
     * @param {string} relativeFilePath target file relaive path from workroot directory
     * @param {string} itemId item id
     * @param {string} commentId comment id
     * @param {string} str target string
     */
    ResolveCommentImagePath(relativeFilePath, itemId, commentId, str) {
        return this.ResolveImagePath_(relativeFilePath, itemId, commentId, str);
    }
}

module.exports = ImageManager;