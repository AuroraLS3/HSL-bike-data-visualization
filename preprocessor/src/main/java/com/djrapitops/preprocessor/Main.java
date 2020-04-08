package com.djrapitops.preprocessor;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class Main {

    public static void main(String[] args) throws Exception {
        Path dataDir = new File("").toPath().toAbsolutePath().getParent()
                .resolve("data");

        Files.createDirectories(dataDir.resolve("preprocessed"));
        for (String fileName : Arrays.asList("data_2017.csv", "data_2018.csv", "data_2019.csv")) {
            parse(dataDir.resolve("preprocessed").resolve(fileName), dataDir.resolve("csv").resolve(fileName));
        }
    }

    private static void parse(Path writeTo, Path file) throws IOException {
        Map<String, StringBuilder> parser = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        System.out.println("Parsing lines of " + file.toString());
        try (Stream<String> lines = Files.lines(file)) {
            lines.forEach(line -> {
                String[] row = line.split(";");
                String id = row[0].trim();
                if (id.contains("NA") || id.contains("id")) {
                    return;
                }
                DataPoint dataPoint = new DataPoint(id, row[7].trim(), row[1].trim(), row[2].trim());
                parser.computeIfAbsent(dataPoint.id, key -> new StringBuilder(dataPoint.id + ";["))
                        .append(",").append(dataPoint.toArrayString());
            });
        }
        System.out.println("Parsing complete, parsed data for " + parser.size() + " stations");

        System.out.println("Generating lines and writing to file..");
        Files.deleteIfExists(writeTo);
        Files.createFile(writeTo);

        try (PrintStream fileStream = new PrintStream(writeTo.toFile())) {
            for (String key : new ArrayList<>(parser.keySet())) {
                StringBuilder line = parser.get(key);
                parser.remove(key);
                int splitter = line.indexOf(";") + 2;
                try {
                    StringBuilder ready = line.replace(splitter, splitter + 1, "").append("]");
                    Thread.sleep(0);
                    fileStream.println(ready.toString());
                    fileStream.flush();
                } catch (OutOfMemoryError e) {
                    System.out.println("Failure copying length: " + line.length());
                    throw e;
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }
}
