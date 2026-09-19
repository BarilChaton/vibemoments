package com.vibemomentssocial.app.admob;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.NativeAd;

@CapacitorPlugin(name = "VibeNativeAd")
public class VibeNativeAdPlugin extends Plugin {

    private static final String TAG = "VibeNativeAd";

    private NativeAd nativeAd;

    @PluginMethod
    public void loadAd(PluginCall call) {
        String adUnitId = call.getString(
            "adUnitId",
            "ca-app-pub-3940256099942544/2247696110"
        );

        getActivity().runOnUiThread(() -> {
            if (nativeAd != null) {
                nativeAd.destroy();
                nativeAd = null;
            }

            AdLoader loader = new AdLoader.Builder(getContext(), adUnitId)
                .forNativeAd(ad -> {
                    nativeAd = ad;

                    Log.d(TAG, "Native ad loaded: " + ad.getHeadline());

                    JSObject result = new JSObject();

                    result.put("loaded", true);
                    result.put("headline", ad.getHeadline());
                    result.put("body", ad.getBody());
                    result.put("advertiser", ad.getAdvertiser());
                    result.put("callToAction", ad.getCallToAction());

                    call.resolve(result);
                })
                .withAdListener(
                    new AdListener() {
                        @Override
                        public void onAdFailedToLoad(LoadAdError error) {
                            Log.e(
                                TAG,
                                "Native ad failed to load: " + error.getMessage()
                            );

                            call.reject(
                                "Native ad failed to load: " + error.getMessage()
                            );
                        }
                    }
                )
                .build();

            loader.loadAd(
                new AdRequest.Builder().build()
            );
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (nativeAd != null) {
            nativeAd.destroy();
            nativeAd = null;
        }

        super.handleOnDestroy();
    }
}