package com.vibemomentssocial.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.vibemomentssocial.app.admob.VibeNativeAdPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VibeNativeAdPlugin.class);

        super.onCreate(savedInstanceState);
    }
}