package com.vibemomentssocial.app.admob;

import android.graphics.Color;
import android.graphics.Typeface;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;

@CapacitorPlugin(name = "VibeNativeAd")
public class VibeNativeAdPlugin extends Plugin {

    private static final String TAG = "VibeNativeAd";

    private NativeAd nativeAd;
    private NativeAdView nativeAdView;

    @PluginMethod
    public void loadAd(PluginCall call) {
        String adUnitId = call.getString(
            "adUnitId",
            "ca-app-pub-3940256099942544/2247696110"
        );

        getActivity().runOnUiThread(() -> {
            destroyCurrentAd();

            AdLoader loader = new AdLoader.Builder(getContext(), adUnitId)
                .forNativeAd(ad -> {
                    nativeAd = ad;

                    Log.d(TAG, "Native ad loaded: " + ad.getHeadline());

                    JSObject result = new JSObject();

                    result.put("loaded", true);
                    result.put("headline", ad.getHeadline());

                    call.resolve(result);
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        Log.e(TAG, "Native ad failed to load: " + error.getMessage());

                        call.reject(
                            "Native ad failed to load: " + error.getMessage()
                        );
                    }
                })
                .build();

            loader.loadAd(
                new AdRequest.Builder().build()
            );
        });
    }

    @PluginMethod
    public void showAd(PluginCall call) {
        if (nativeAd == null) {
            call.reject("Native ad has not been loaded.");
            return;
        }

        Double x = call.getDouble("x");
        Double y = call.getDouble("y");
        Double width = call.getDouble("width");
        Double height = call.getDouble("height");

        if (x == null || y == null || width == null || height == null) {
            call.reject("Missing native ad position.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            removeNativeAdView();

            float density = getContext().getResources().getDisplayMetrics().density;

            int left = Math.round((float) (x * density));
            int top = Math.round((float) (y * density));
            int adWidth = Math.round((float) (width * density));
            int adHeight = Math.round((float) (height * density));

            nativeAdView = createNativeAdView(nativeAd);

            FrameLayout.LayoutParams params =
                new FrameLayout.LayoutParams(adWidth, adHeight);

            params.leftMargin = left;
            params.topMargin = top;

            FrameLayout root =
                getActivity().findViewById(android.R.id.content);

            root.addView(nativeAdView, params);

            nativeAdView.bringToFront();

            JSObject result = new JSObject();
            result.put("shown", true);

            call.resolve(result);
        });
    }

    @PluginMethod
    public void hideAd(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            removeNativeAdView();

            call.resolve();
        });
    }

    private NativeAdView createNativeAdView(NativeAd ad) {
        NativeAdView adView =
            new NativeAdView(getContext());

        LinearLayout container =
            new LinearLayout(getContext());

        container.setOrientation(LinearLayout.VERTICAL);
        container.setPadding(dp(16), dp(14), dp(16), dp(14));
        container.setBackgroundColor(Color.WHITE);

        // Sponsored label
        TextView sponsored =
            new TextView(getContext());

        sponsored.setText("Sponsored");
        sponsored.setTextSize(10);
        sponsored.setTextColor(Color.GRAY);

        container.addView(sponsored);

        // Media
        MediaView mediaView =
            new MediaView(getContext());

        LinearLayout.LayoutParams mediaParams =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(120)
            );

        mediaParams.topMargin = dp(8);

        container.addView(mediaView, mediaParams);

        adView.setMediaView(mediaView);

        // Headline
        TextView headline =
            new TextView(getContext());

        headline.setText(ad.getHeadline());
        headline.setTextSize(18);
        headline.setTextColor(Color.BLACK);
        headline.setTypeface(null, Typeface.BOLD);

        LinearLayout.LayoutParams headlineParams =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );

        headlineParams.topMargin = dp(10);

        container.addView(headline, headlineParams);

        adView.setHeadlineView(headline);

        // Body
        TextView body =
            new TextView(getContext());

        body.setText(ad.getBody());
        body.setTextSize(13);
        body.setTextColor(Color.DKGRAY);

        LinearLayout.LayoutParams bodyParams =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );

        bodyParams.topMargin = dp(4);

        container.addView(body, bodyParams);

        adView.setBodyView(body);

        // Advertiser
        TextView advertiser =
            new TextView(getContext());

        advertiser.setText(ad.getAdvertiser());
        advertiser.setTextSize(11);
        advertiser.setTextColor(Color.GRAY);

        LinearLayout.LayoutParams advertiserParams =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );

        advertiserParams.topMargin = dp(8);

        container.addView(advertiser, advertiserParams);

        adView.setAdvertiserView(advertiser);

        // CTA
        Button callToAction =
            new Button(getContext());

        callToAction.setText(
            ad.getCallToAction() != null
                ? ad.getCallToAction()
                : "Learn more"
        );

        LinearLayout.LayoutParams buttonParams =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            );

        buttonParams.topMargin = dp(10);

        container.addView(callToAction, buttonParams);

        adView.setCallToActionView(callToAction);

        adView.addView(
            container,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );

        if (ad.getBody() == null) {
            body.setVisibility(View.GONE);
        }

        if (ad.getAdvertiser() == null) {
            advertiser.setVisibility(View.GONE);
        }

        adView.setNativeAd(ad);

        return adView;
    }

    private int dp(int value) {
        float density =
            getContext()
                .getResources()
                .getDisplayMetrics()
                .density;

        return Math.round(value * density);
    }

    private void removeNativeAdView() {
        if (nativeAdView != null) {
            if (nativeAdView.getParent() instanceof FrameLayout) {
                ((FrameLayout) nativeAdView.getParent())
                    .removeView(nativeAdView);
            }

            nativeAdView = null;
        }
    }

    private void destroyCurrentAd() {
        removeNativeAdView();

        if (nativeAd != null) {
            nativeAd.destroy();
            nativeAd = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        destroyCurrentAd();

        super.handleOnDestroy();
    }
}