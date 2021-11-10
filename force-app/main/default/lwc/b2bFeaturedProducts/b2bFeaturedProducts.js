import { LightningElement, api, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { getPathPrefix } from "lightning/configProvider"; // Provides the path prefix to Core resources, like CMS (https://salesforce.quip.com/1FZjAXYICqML)

// CONTROLLER METHODS
import getProductsBySku from "@salesforce/apex/B2B_FeaturedProducts_Controller.getProductsBySku";
import getProductsByCategoryId from "@salesforce/apex/B2B_FeaturedProducts_Controller.getProductsByCategoryId";
import getProductsByFieldValue from "@salesforce/apex/B2B_FeaturedProducts_Controller.getProductsByFieldValue";
// import resolveCommunityIdToWebstoreId from "@salesforce/apex/B2B_FeaturedProducts_Controller.resolveCommunityIdToWebstoreId";
import fetchInitValues from "@salesforce/apex/B2B_FeaturedProducts_Controller.fetchInitValues";

// STORE IDS
import USERID from "@salesforce/user/Id";
import COMMUNITYID from "@salesforce/community/Id";
import CURRENCY_CODE from "@salesforce/i18n/currency";
import BASE_PATH from "@salesforce/community/basePath";

// LABELS
import searchErrorTitle from "@salesforce/label/c.B2B_FP_Search_Error_Title";
import altPleaseWait from "@salesforce/label/c.B2B_FP_Alt_Text_Please_Wait";
import noProducts from "@salesforce/label/c.B2B_FP_No_Products";

import { getPreviewProducts } from "c/b2bFeaturedProductsPreview";
import previewStaticResource from "@salesforce/resourceUrl/B2B_LE_Pictures";

export default class B2bFeaturedProducts extends LightningElement {
	// @api flexipageRegionWidth; // https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.use_width_aware

	labels = {
		toast: {
			searchErrorTitle: searchErrorTitle
		},
		component: {
			altPleaseWait: altPleaseWait,
			noProducts: noProducts
		}
	};

	products = [];
	@track hasProducts = false;

	// These properties are set within experience builder and passed to the component
	@api featuredProductStyle;

	@api showHeading;
	@api featuredProductsHeading;
	@api featuredProductsHeadingSize;
	@api featuredProductsHeadingAlignment;

	@api featuredProductsBodySize;
	@api featuredProductsBodyAlignment;

	@api showSKU;
	@api showDescription;
	@api includePrices;

	@api featuredProductsComponentBackgroundColor;
	@api featuredProductsBackgroundColor;
	@api featuredProductsBorderColor;
	@api featuredProductsHeadingColor;
	@api featuredProductsSkuColor;
	@api featuredProductsDescriptionColor;
	@api featuredProductsPriceColor;

	@api productSource;
	@api skuList;
	@api categoryId;
	@api effectiveAccountId;

	@api fieldValue;
	@api compareType;
	@api fieldApiName;

	@track showLoadingSpinner = false;
	@track templateWidth;
	@track templateSize;
	@track tileWidth;
	@track tileHeight;

	communityId = COMMUNITYID;
	currencyCode = CURRENCY_CODE;
	userId = USERID;
	webstoreId;
	skuListFormatted;

	initialLoad = false;
	isTiled = false;
	isStacked = false;

	connectedCallback() {
		console.log("connectedCallback()");
		console.log('base path:', BASE_PATH);

		window.addEventListener("resize", this.windowResize.bind(this));

		if (this.featuredProductStyle === "Tiled") this.isTiled = true;
		if (this.featuredProductStyle === "Stacked") this.isStacked = true;

		if (this.skuList) {
			this.skuListFormatted = this.skuList.replace(/\s*,\s*/g, ",");
			this.skuListFormatted = this.skuListFormatted.split(",");
		}

		this.doInit();
	}

	renderedCallback() {
		// ONLY RUN IF LAYOUT IS TILED
		if (this.hasProducts) {
			if (this.isTiled) {
				this.windowResize();
			}
		}
	}

	doInit() {
		fetchInitValues({
			communityId: this.communityId,
			effectiveAccountId: this.effectiveAccountId
		})
			.then((result) => {
				if (result) {
					this.webstoreId = result.webstoreId;
					this.effectiveAccountId = result.effectiveAccountId;
					this.doProductLoad();
				}
			})
			.catch((error) => {
				console.log("fetchInitValues(): error");
				console.log(error);
				this.showLoadingSpinner = false;
				this.dispatchEvent(
					new ShowToastEvent({
						title: this.labels.toast.searchErrorTitle,
						message: error.message,
						variant: "error"
					})
				);
			});
	}

	doProductLoad() {
		console.log("doProductLoad()");

		console.log("webstoreId", this.webstoreId);
		console.log("effectiveAccountId", this.effectiveAccountId);
		console.log("productSource", this.productSource);
		console.log("includePrices", this.includePrices);

		/*
			A user in Experience Builder does have a userId and an effectiveAccountId of zeroes.
			Guest users don't have a userId but have an effectiveAccountId of zeroes.
		*/
		if (this.userId !== undefined && this.effectiveAccountId === "000000000000000") {
			this.products = this.getPreviewProducts();
			return;
		}

		this.showLoadingSpinner = true;

		if (this.productSource === "SKU List") {
			this.loadProductsBySku();
		}

		if (this.productSource === "Category ID") {
			this.loadProductsByCategoryId();
		}

		if (this.productSource === "Field") {
			this.loadProductsByField();
		}
	}

	loadProductsBySku() {
		console.log("loadProductsBySku() begin");
		console.log("skuListFormatted", this.skuListFormatted);

		getProductsBySku({
			webstoreId: this.webstoreId,
			effectiveAccountId: this.effectiveAccountId === "000000000000000" ? null : this.effectiveAccountId,
			skuList: this.skuListFormatted,
			includePrices: this.includePrices
		})
			.then((result) => {
				this.processResult(result);
			})
			.catch((error) => {
				this.processError(error);
			});
	}

	loadProductsByCategoryId() {
		console.log("loadProductsByCategoryId() begin");
		console.log("categoryId", this.categoryId);

		getProductsByCategoryId({
			webstoreId: this.webstoreId,
			effectiveAccountId: this.effectiveAccountId === "000000000000000" ? null : this.effectiveAccountId,
			categoryId: this.categoryId,
			includePrices: this.includePrices
		})
			.then((result) => {
				this.processResult(result);
			})
			.catch((error) => {
				this.processError(error);
			});
	}

	loadProductsByField() {
		console.log("loadProductsByField() begin");
		console.log("fieldApiName", this.fieldApiName);
		console.log("fieldValue", this.fieldValue);
		console.log("compareType", this.compareType);

		getProductsByFieldValue({
			webstoreId: this.webstoreId,
			effectiveAccountId: this.effectiveAccountId === "000000000000000" ? null : this.effectiveAccountId,
			fieldApiName: this.fieldApiName,
			fieldValue: this.fieldValue,
			compareType: this.compareType,
			includePrices: this.includePrices
		})
			.then((result) => {
				this.processResult(result);
			})
			.catch((error) => {
				this.processError(error);
			});
	}

	processResult(result) {
		this.showLoadingSpinner = false;

		if (result && result.data) {
			this.hasProducts = true;
			let productResults = JSON.parse(result.data);

			this.processProductResults(productResults);
		}

		this.processMessages(result);
	}

	processProductResults(productResults) {
		for (const product of productResults) {
			// format image url
			let url = product.defaultImage.url;

			if (url.indexOf("/cms/delivery/media") >= 0) {
				const searchRegExp = /\/cms\/delivery\/media/g;

				url = url.replace(searchRegExp, this.communityName + "/cms/delivery/media");
			}

			if (url.indexOf("/cms/media") >= 0) {
				const searchRegExp = /\/cms\/media/g;

				url = url.replace(searchRegExp, this.communityName + "/cms/delivery/media");
			}

			product.defaultImage.url = url;

			// format product link
			let prodLink = BASE_PATH + "/product/" + product.id;
			product.productLink = prodLink;

			this.products.push(product);
		}
	}

	processError(error) {
		this.showLoadingSpinner = false;
		this.dispatchEvent(
			new ShowToastEvent({
				title: this.labels.toast.searchErrorTitle,
				message: error.body.message,
				variant: "error"
			})
		);
	}

	processMessages(result) {
		if (result.messagesJson) {
			let messages = JSON.parse(result.messagesJson);

			// Process messages returned
			// Display toasts when applicable
			// Create content for the details section

			for (var i = 0; i < messages.length; i++) {
				var message = messages[i];

				if (message.toast === true) {
					this.dispatchEvent(
						new ShowToastEvent({
							title: message.title,
							message: message.message,
							variant: message.severity
						})
					);
				}
			}

			this.showProcessLog = true;
		}
	}

	getPreviewProducts() {
		const products = getPreviewProducts(getPathPrefix(), previewStaticResource);
		this.hasProducts = true;

		return products;
	}

	windowResize() {
		this.templateSize = null;

		const templateSelector = this.template.querySelector(".featuredProductsContainer");
		this.templateWidth = templateSelector.getBoundingClientRect().width;

		// TEMPLATE WIDTH BREAKPOINTS
		// X-SMALL (< 480px)
		// SMALL (>= 480px)
		// MEDIUM (>=768px)
		// LARGE (>=1024px)

		const tiles = this.template.querySelectorAll(".tile-column");

		for (const tile of tiles) {
			this.tileWidth = this.template.querySelector(".featuredProdImage").getBoundingClientRect().width;

			tile.classList.remove("slds-size_1-of-1");
			tile.classList.remove("slds-size_1-of-2");
			tile.classList.remove("slds-size_1-of-3");
			tile.classList.remove("slds-size_1-of-4");

			// X-SMALL
			if (this.templateWidth < 480) {
				this.templateSize = "x-small";
				tile.classList.add("slds-size_1-of-1");
			}

			// SMALL
			if (this.templateWidth >= 480 && this.templateWidth < 768) {
				this.templateSize = "small";
				tile.classList.add("slds-size_1-of-2");
			}

			// MEDIUM
			if (this.templateWidth >= 768 && this.templateWidth < 1024) {
				this.templateSize = "medium";
				tile.classList.add("slds-size_1-of-3");
			}

			// LARGE
			if (this.templateWidth >= 1024) {
				this.templateSize = "large";
				tile.classList.add("slds-size_1-of-4");
			}
		}

		this.tileHeight = this.tileWidth;

		// console.log("tileWidth", this.tileWidth);
		// console.log("tileHeight", this.tileHeight);
	}

	// GETTERS & SETTERS
	get communityName() {
		let path = BASE_PATH;
		let pos = BASE_PATH.lastIndexOf("/s");
		if (pos >= 0) {
			path = BASE_PATH.substring(0, pos);
		}

		return path;
	}

	// SIZE GETTERS
	get imageContainerHeight() {
		let tileHeight = "";

		if (this.tileHeight) {
			tileHeight = this.tileHeight.toString();
		}

		return `height:${tileHeight}px;`;
	}

	get imageMaxHeight() {
		let imageMaxHeight = "";

		if (this.tileHeight) {
			imageMaxHeight = this.tileHeight.toString();
		}

		return `max-height:${imageMaxHeight}px;`;
	}

	get headingSize() {
		let sizeClass = "slds-text-heading_";
		if (this.featuredProductsHeadingSize) {
			sizeClass += this.featuredProductsHeadingSize.toLowerCase();
		}
		return sizeClass;
	}

	get bodySize() {
		let sizeClass = "slds-text-body_";
		if (this.featuredProductsBodySize) {
			sizeClass += this.featuredProductsBodySize.toLowerCase();
		}
		return sizeClass;
	}

	// ALIGNMENT GETTERS
	get headingAlignment() {
		let alignmentClass = "slds-text-align_";
		if (this.featuredProductsHeadingAlignment) {
			alignmentClass += this.featuredProductsHeadingAlignment.toLowerCase();
		}
		return alignmentClass;
	}

	get bodyAlignment() {
		let alignmentClass = "slds-text-align_";
		if (this.featuredProductsBodyAlignment) {
			alignmentClass += this.featuredProductsBodyAlignment.toLowerCase();
		}
		return alignmentClass;
	}

	// COLOR GETTERS
	get componentStyles() {
		return `background-color:${this.featuredProductsComponentBackgroundColor};`;
	}

	get cardStyles() {
		return `background-color:${this.featuredProductsBackgroundColor}; border-color:${this.featuredProductsBorderColor};`;
	}

	get headingColor() {
		return `color:${this.featuredProductsHeadingColor};`;
	}

	get skuColor() {
		return `color:${this.featuredProductsSkuColor};`;
	}

	get descriptionColor() {
		return `color:${this.featuredProductsDescriptionColor};`;
	}

	get priceColor() {
		return `color:${this.featuredProductsPriceColor};`;
	}
}